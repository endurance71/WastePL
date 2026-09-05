import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import {
  TelemetryService,
  type ResidentTelemetryEventInput,
  type ResidentTelemetryEventType,
} from './telemetry.service.js';

const MAX_BATCH_SIZE = 100;
const MAX_EVENT_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

const EVENT_TYPES = new Set<ResidentTelemetryEventType>([
  'APP_OPEN',
  'RETURN_VISIT',
  'ADDRESS_SEARCH',
  'ADDRESS_SELECTED',
  'SCHEDULE_SHOWN',
  'REMINDER_ICS_EXPORT',
  'REMINDER_PUSH_OPT_IN',
  'FEEDBACK_MODAL_OPEN',
  'FEEDBACK_SUBMITTED',
]);

const REMINDER_TIMINGS = new Set([
  'EVENING_BEFORE_20',
  'EVENING_BEFORE_18',
  'MORNING_OF_06',
  'BOTH',
]);

const FEEDBACK_TYPES = new Set(['CORRECT', 'WRONG_DATE', 'MISSING_FRACTION', 'OTHER']);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalBoundedString(
  payload: JsonObject,
  key: string,
  maxLength: number,
): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) return undefined;
  return value;
}

function optionalInteger(
  payload: JsonObject,
  key: string,
  min: number,
  max: number,
): number | undefined {
  const value = payload[key];
  if (!Number.isInteger(value) || typeof value !== 'number' || value < min || value > max) {
    return undefined;
  }
  return value;
}

function optionalBoolean(payload: JsonObject, key: string): boolean | undefined {
  const value = payload[key];
  return typeof value === 'boolean' ? value : undefined;
}

function sanitizePayload(
  eventType: ResidentTelemetryEventType,
  rawPayload: unknown,
): Record<string, string | number | boolean | null> {
  const payload = isObject(rawPayload) ? rawPayload : {};
  const sanitized: Record<string, string | number | boolean | null> = {};

  switch (eventType) {
    case 'ADDRESS_SEARCH': {
      const queryLength = optionalInteger(payload, 'queryLength', 0, 512);
      const resultCount = optionalInteger(payload, 'resultCount', 0, 250);
      if (queryLength !== undefined) sanitized.queryLength = queryLength;
      if (resultCount !== undefined) sanitized.resultCount = resultCount;
      break;
    }
    case 'ADDRESS_SELECTED': {
      const terc = optionalBoundedString(payload, 'terc', 7);
      if (terc && /^\d{7}$/.test(terc)) sanitized.terc = terc;
      break;
    }
    case 'SCHEDULE_SHOWN': {
      const terc = optionalBoundedString(payload, 'terc', 7);
      const eventCount = optionalInteger(payload, 'eventCount', 0, 500);
      const isCached = optionalBoolean(payload, 'isCached');
      const sourceParser = optionalBoundedString(payload, 'sourceParser', 64);
      if (terc && /^\d{7}$/.test(terc)) sanitized.terc = terc;
      if (eventCount !== undefined) sanitized.eventCount = eventCount;
      if (isCached !== undefined) sanitized.isCached = isCached;
      if (sourceParser !== undefined) sanitized.sourceParser = sourceParser;
      break;
    }
    case 'REMINDER_ICS_EXPORT': {
      const eventCount = optionalInteger(payload, 'eventCount', 0, 500);
      const fractionFilter = optionalBoundedString(payload, 'fractionFilter', 48);
      const sourceParser = optionalBoundedString(payload, 'sourceParser', 64);
      if (eventCount !== undefined) sanitized.eventCount = eventCount;
      if (fractionFilter !== undefined) sanitized.fractionFilter = fractionFilter;
      if (sourceParser !== undefined) sanitized.sourceParser = sourceParser;
      break;
    }
    case 'REMINDER_PUSH_OPT_IN': {
      const timing = optionalBoundedString(payload, 'timing', 32);
      if (timing && REMINDER_TIMINGS.has(timing)) sanitized.timing = timing;
      break;
    }
    case 'FEEDBACK_SUBMITTED': {
      const feedbackType = optionalBoundedString(payload, 'feedbackType', 32);
      const isCorrect = optionalBoolean(payload, 'isCorrect');
      if (feedbackType && FEEDBACK_TYPES.has(feedbackType)) sanitized.feedbackType = feedbackType;
      if (isCorrect !== undefined) sanitized.isCorrect = isCorrect;
      break;
    }
    case 'APP_OPEN':
    case 'RETURN_VISIT':
    case 'FEEDBACK_MODAL_OPEN':
      break;
  }

  return sanitized;
}

function parseEvent(value: unknown, now: number): ResidentTelemetryEventInput {
  if (!isObject(value)) {
    throw new BadRequestException({ code: 'INVALID_EVENT', message: 'Each event must be an object' });
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!id || id.length > 80) {
    throw new BadRequestException({ code: 'INVALID_EVENT_ID', message: 'event id must be 1-80 characters' });
  }

  const installationId = typeof value.installationId === 'string' ? value.installationId.trim() : '';
  if (!installationId || installationId.length > 128) {
    throw new BadRequestException({
      code: 'INVALID_INSTALLATION_ID',
      message: 'installationId must be 1-128 characters',
    });
  }

  if (typeof value.eventType !== 'string' || !EVENT_TYPES.has(value.eventType as ResidentTelemetryEventType)) {
    throw new BadRequestException({ code: 'INVALID_EVENT_TYPE', message: 'Unsupported telemetry event type' });
  }
  const eventType = value.eventType as ResidentTelemetryEventType;

  if (typeof value.timestamp !== 'string') {
    throw new BadRequestException({ code: 'INVALID_TIMESTAMP', message: 'timestamp must be ISO-8601 text' });
  }
  const parsedTimestamp = Date.parse(value.timestamp);
  if (
    !Number.isFinite(parsedTimestamp) ||
    parsedTimestamp < now - MAX_EVENT_AGE_MS ||
    parsedTimestamp > now + MAX_FUTURE_SKEW_MS
  ) {
    throw new BadRequestException({
      code: 'INVALID_TIMESTAMP',
      message: 'timestamp is invalid or outside the accepted time window',
    });
  }

  return {
    id,
    installationId,
    eventType,
    timestamp: new Date(parsedTimestamp).toISOString(),
    payload: sanitizePayload(eventType, value.payload),
  };
}

@Controller('v1/telemetry')
export class TelemetryController {
  constructor(@Inject(TelemetryService) private readonly telemetry: TelemetryService) {}

  @Post('events')
  async ingest(
    @Body() body: unknown,
  ): Promise<{ status: 'OK'; received: number; accepted: number; deduplicated: number }> {
    if (!isObject(body) || !Array.isArray(body.events) || body.events.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_TELEMETRY_BATCH',
        message: 'events must be a non-empty array',
      });
    }

    if (body.events.length > MAX_BATCH_SIZE) {
      throw new BadRequestException({
        code: 'TELEMETRY_BATCH_TOO_LARGE',
        message: `A maximum of ${MAX_BATCH_SIZE} events is accepted per request`,
      });
    }

    const now = Date.now();
    const events = body.events.map((event) => parseEvent(event, now));
    const result = await this.telemetry.ingest(events);

    return {
      status: 'OK',
      received: events.length,
      accepted: result.accepted,
      deduplicated: result.deduplicated,
    };
  }
}
