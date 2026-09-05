# Runbook: Wdrożenie Staging i Production oraz Disaster Recovery

## 1. Architektura Środowiska i Topologia Sieciowa

Architektura produkcyjna i stagingowa WastePL opiera się na separacji ruchu brzegowego od warstwy danych:

```text
Internet
  │  (Porty 80 / 443 — Public TLS / Let's Encrypt / HSTS)
  ▼
Caddy Reverse Proxy
  ├── /v1/* ──────────────► WastePL API (Fastify/NestJS, port 3000)
  │                            │
  └── /* ─────────────────► WastePL PWA (Nginx Alpine SPA, port 80)
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       PostgreSQL / PostGIS             Redis 7.2
       (Internal network only)    (Internal network only)
                ▲                             ▲
                └──────────────┬──────────────┘
                               │
                      WastePL Worker ◄──────► MinIO S3
                   (Scheduled Tasks / Push)  (Internal network only)
```

### Izolacja sieciowa (Bramka P1-B.1 & P1-B.2)
1. **PostgreSQL / PostGIS 16-3.4**: Odizolowany w sieci `wastepl-backend`. Port bazy jest powiązany wyłącznie z pętlą zwrotną `127.0.0.1:5432` dla lokalnych narzędzi administracyjnych.
2. **Redis 7.2 Alpine**: Odizolowany w sieci `wastepl-backend`. Port powiązany wyłącznie z `127.0.0.1:6379`.
3. **MinIO Object Storage**: Trwały magazyn surowych artefaktów. Porty 9000 i 9001 powiązane wyłącznie z `127.0.0.1`.
4. **WastePL API (`apps/api`)**: Połączony z obiema sieciami (`wastepl-backend` i `wastepl-frontend`).
5. **WastePL Worker (`apps/worker`)**: Działa w sieci `wastepl-backend`.
6. **Consumer PWA (`apps/pwa`)**: Kontener Nginx serwujący zoptymalizowany build SPA w sieci `wastepl-frontend`.
7. **Caddy Reverse Proxy**: Jedyny kontener wystawiający porty `80` i `443` na świat, z automatycznym certyfikatem TLS i nagłówkami bezpieczeństwa.

---

## 2. Zarządzanie Sekretami i Konfiguracja Środowiska

Zmienne środowiskowe wymagane do uruchomienia produkcyjnego:

| Zmienna | Opis | Przykład / Wymóg |
| :--- | :--- | :--- |
| `DOMAIN` | Publiczna domena serwisu | `staging.wastepl.pl` lub `app.wastepl.pl` |
| `DATABASE_URL` | Połączenie z bazą danych PostgreSQL | `postgresql://user:pass@postgres:5432/wastepl` |
| `REDIS_URL` | Połączenie z instancją Redis | `redis://:pass@redis:6379` |
| `S3_ENDPOINT` | Endpoint magazynu S3 / MinIO | `http://minio:9000` |
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
   docker compose -f docker-compose.prod.yml up -d --build
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
# Lokalny zrzut bazy z metadanymi i sumą kontrolną SHA-256:
node scripts/db-backup.mjs

# Symulacja dry-run (weryfikacja bez zapisu na dysku):
pnpm db:backup:dry-run
```

W konfiguracji produkcyjnej ze zmienną `OFFSITE_BACKUP_S3_BUCKET`, zrzut jest automatycznie wysyłany do zewnętrznego zasobnika S3 / Cloudflare R2 z szyfrowaniem SSE-S3.

### Odtwarzanie bazy danych z kopii zapasowej (Automated Restore)
W przypadku awarii lub konieczności wycofania stanu bazy:
```bash
# 1. Zatrzymanie ruchu aplikacyjnego
docker compose -f docker-compose.prod.yml stop api worker

# 2. Weryfikacja integralności i odtworzenie zrzutu
node scripts/db-restore.mjs --dry-run
node scripts/db-restore.mjs backups/wastepl-db-backup-<TIMESTAMP>.sql

# 3. Ponowne uruchomienie aplikacji
docker compose -f docker-compose.prod.yml start api worker
```
Skrypt `db-restore.mjs` weryfikuje sumę SHA-256 pliku względem metadanych `.json` przed rozpoczęciem zapisu do bazy PostgreSQL.

---

## 5. Monitoring, Obserwowalność i Alerting (Bramka P1-B.7)

System wdraża trójstopniowy monitoring operacyjny:
1. **Liveness & Readiness**:
   - `GET /v1/health` odpytywany co 15 sekund przez zewnętrzny probe (np. Uptime Kuma / Better Stack).
   - Weryfikacja łączności z bazą PostgreSQL (`SELECT 1`).
2. **Staging Alerting Runbook**:
   - Wykrycie statusu `degraded` lub kodu odpowiedzi 5xx przez > 60 sekund generuje alert o priorytecie P1.
   - Błędy dyspozycji powiadomień Web Push (`push dispatch failures`) logowane w formacie structured JSON z kontekstem `jobId`.
3. **Log Aggregation**:
   - Wszystkie serwisy API i Worker emitują ustrukturyzowane logi JSON ze stałym `x-request-id` do standardowego wyjścia (stdout).

---

## 6. Uruchomienie Kontrolowanego Pilota Kohorty Mieszkańców (Bramka P2.1)

Kontrolowany pilot z realnymi użytkownikami uruchamiany jest zgodnie z bramką **P2.1** roadmapy, która zakłada zapraszanie mieszkańców **wyłącznie z bezpiecznie obsługiwanych zakresów** (Address Coverage $\ge 95\%$ zapraszanej grupy) bez udawania, że cały region jest już pokryty.

### Zdefiniowane kohorty pilotowe (100% poprawności, 0% ambiguity)

| Kohorta | Gmina | Zakres / Miejscowość | Adresy PRG | Zbiórka / Frakcje | Status bramki P2.1 |
| :--- | :--- | :--- | ---: | :--- | :--- |
| **Kohorta 1 (Świeszyno-Chałupy)** | Świeszyno | Sołectwo Chałupy (Trasa I) | **167** | Wszystkie frakcje H2 (zmieszane, bio, papier, plastik, szkło) | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 2 (Bobolice-Kłanino)** | Bobolice | Miejscowość Kłanino | **65** | Zabudowa jednorodzinna H2 | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 3 (Manowo-Bonin+)** | Manowo | Bonin, Dęborogi, Policko, Wyszebórz | **46** | Trasa 2AB (pełen harmonogram miesięczny) | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 4 (Tychowo-Wieś)** | Tychowo | Tereny wiejskie (grupy 1–4) | **45** | Zabudowa jednorodzinna wiejska | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 5 (Polanów-Garbno)** | Polanów | Miejscowość Garbno | **39** | Zabudowa jednorodzinna H2 | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 6 (Sianów-Grabówko)** | Sianów | Miejscowość Grabówko | **31** | Zabudowa jednorodzinna H2 | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 7 (Będzino-Dworek)** | Będzino | Miejscowość Dworek (Trasa I) | **13** | Zabudowa jednorodzinna H2 | **GOTOWA DO ZAPROSZEŃ** |
| **Kohorta 8 (Koszalin-Bio-Pilot)** | Koszalin | Ulice objęte pilotażem BIO | **9** | Frakcja BIO zabudowa wielorodzinna | **GOTOWA (z zastrzeżeniem bio-only)** |

### Procedura rekrutacji i bezpieczeństwo mieszkańców

1. **Weryfikacja adresu przed zaproszeniem**:
   - Mieszkaniec wpisuje adres w PWA.
   - W przypadku adresu spoza kohorty aplikacja zwraca czytelny status `404 NOT_COVERED` informujący o planowanym harmonogramie dla danej gminy, bez generowania fałszywych terminów.
2. **Obserwacja telemetryczna lejka (P2.2)**:
   - Dashboard monitoruje w czasie rzeczywistym przejście przez lejek: `APP_OPEN` -> `ADDRESS_SEARCH` -> `ADDRESS_SELECTED` -> `SCHEDULE_SHOWN` -> `REMINDER_ICS_EXPORT` / `REMINDER_PUSH_OPT_IN` -> `RETURN_VISIT`.
   - Rejestrowany jest wskaźnik konwersji i czas do pierwszego harmonogramu.
3. **Pętla zwrotna jakości (P2.3)**:
   - Przycisk „Zgłoś uwagę” (`ScheduleFeedbackModal`) umożliwia mieszkańcowi natychmiastowe zgłoszenie `WRONG_DATE`, `MISSING_FRACTION` lub potwierdzenie poprawności `CORRECT`.
   - Zgłoszenia trafiają do tabeli `feedback_discrepancy` z identyfikatorem `installationId` i znacznikiem czasu klienta.
   - Każde zgłoszenie o rozbieżności wstrzymuje automatyczne potwierdzanie źródła i kieruje rewizję do manualnego przeglądu (`REVIEW_REQUIRED`).

