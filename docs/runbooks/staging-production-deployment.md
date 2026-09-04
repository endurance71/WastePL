# Runbook: Wdrożenie Staging i Production oraz Disaster Recovery

## 1. Architektura Środowiska

Architektura produkcyjna WastePL składa się z 5 ściśle odizolowanych komponentów:
1. **PostgreSQL / PostGIS 16-3.4**: Baza danych z modelem temporalnym, tabelami geometrycznymi PRG i audytowalnymi subskrypcjami push.
2. **Redis 7.2 Alpine**: Kolejki BullMQ (`INGESTION_QUEUE`, `ARTIFACT_PROCESSING_QUEUE`), deduplikacja zadań i cache.
3. **MinIO Object Storage**: Trwały, niemutowalny magazyn pobranych surowych artefaktów źródłowych (PDF/HTML) ze sprawdzaniem sum kontrolnych SHA-256.
4. **WastePL API (`apps/api`)**: Czysty Fastify/NestJS microservice serwujący REST API (`/v1/addresses`, `/v1/collection`, `/v1/facilities`, `/v1/notifications`, `/v1/feedback`). Posiada wbudowany rate limiter, structured request logging oraz nagłówki HSTS i CSP.
5. **WastePL Worker (`apps/worker`)**: Wieloetapowy procesor danych: harmonogramowanie odpytywania źródeł, transakcyjne publikowanie harmonogramów oraz wysyłka powiadomień Web Push o określonych godzinach w strefie `Europe/Warsaw`.

---

## 2. Zarządzanie Sekretami i Konfiguracja Środowiska

Zmienne środowiskowe wymagane do uruchomienia produkcyjnego:

| Zmienna | Opis | Przykład / Wymóg |
| :--- | :--- | :--- |
| `DATABASE_URL` | Połączenie z bazą danych PostgreSQL | `postgresql://user:pass@host:5432/wastepl` |
| `REDIS_URL` | Połączenie z klastrem / instancją Redis | `redis://:pass@host:6379` |
| `S3_ENDPOINT` | Endpoint magazynu S3 / MinIO | `https://s3.wastepl.pl` |
| `S3_BUCKET` | Nazwa bucketu artefaktów | `wastepl-prod-artifacts` |
| `S3_ACCESS_KEY` | Klucz dostępowy S3 | Bezpieczny ciąg znaków |
| `S3_SECRET_KEY` | Klucz tajny S3 | Bezpieczny ciąg znaków |
| `VAPID_PUBLIC_KEY` | Publiczny klucz Web Push VAPID | Wygenerowany klucz base64url |
| `VAPID_PRIVATE_KEY` | Prywatny klucz Web Push VAPID | Ściśle strzeżony klucz VAPID |
| `VAPID_SUBJECT` | Identyfikator e-mail nadawcy push | `mailto:security@wastepl.pl` |
| `WASTEPL_ADMIN_KEY` | Klucz dostępowy do wewnętrznych API | Długi losowy token do `internal/v1/*` |

---

## 3. Procedura Wdrożenia (Zero-Downtime Migration)

1. **Krok 1: Kopia zapasowa bazy danych**
   Przed każdą aktualizacją wykonaj procedurę backupu:
   ```bash
   node scripts/db-backup.mjs
   ```
2. **Krok 2: Uruchomienie migracji bazy danych**
   Migracje są w 100% idempotentne i wstecznie kompatybilne:
   ```bash
   pnpm db:migrate
   ```
3. **Krok 3: Rolling update serwisów kontenerowych**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build --no-deps api worker
   ```
4. **Krok 4: Weryfikacja zdrowia systemu**
   ```bash
   curl -f http://127.0.0.1:3000/v1/health
   # Oczekiwana odpowiedź: {"status":"ok","service":"wastepl","database":"connected"}
   ```

---

## 4. Disaster Recovery i Odtwarzanie Bazy (Backup & Restore)

### Wykonanie kopii zapasowej
Skrypt tworzy czysty zrzut danych, oblicza sumę SHA-256 i zapisuje metadane w katalogu `backups/`:
```bash
node scripts/db-backup.mjs
```

### Odtwarzanie bazy danych z kopii zapasowej
W przypadku awarii lub konieczności wycofania stanu bazy:
```bash
# 1. Zatrzymanie ruchu aplikacyjnego
docker compose -f docker-compose.prod.yml stop api worker

# 2. Odtworzenie zrzutu do bazy danych
cat backups/wastepl-db-backup-<TIMESTAMP>.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U wastepl -d wastepl

# 3. Ponowne uruchomienie aplikacji
docker compose -f docker-compose.prod.yml start api worker
```
