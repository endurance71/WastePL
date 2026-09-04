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
