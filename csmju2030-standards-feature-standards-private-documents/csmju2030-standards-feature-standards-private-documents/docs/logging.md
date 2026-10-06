# Logging

**เวอร์ชัน 1.1** (standards 1.7.0) · บังคับกับทุกระบบย่อย

ระบบย่อยต้อง log เหตุการณ์ด้านการยืนยันตัวตนและสิทธิ์เป็น **structured log** (JSON บรรทัดเดียว)
เพื่อให้ตรวจสอบย้อนหลังและหาสาเหตุร่วมกันได้ทุกระบบ

ชื่อ event และ `reason` เป็นรายการปิด อยู่ใน [`../contracts/log-events.json`](../contracts/log-events.json)
— ถ้าเอกสารนี้กับไฟล์นั้นไม่ตรงกัน ให้ยึดไฟล์นั้น

---

## 1. Event ที่ต้องมี

| event | เมื่อไร | field ที่ต้องมี |
|---|---|---|
| `subsystem.started` | ตอนบูต | `subsystem`, `port`, `coreHubUrl`, `jwksUrl`, `issuer`, `audience` |
| `jwks.refresh` | ดึง JWKS สำเร็จ | `reason`, `keyCount`, `kids` |
| `jwks.refresh.failure` | ดึง JWKS ไม่สำเร็จ | `reason`, `cachedKeyCount` |
| `jwks.unknown_kid` | `kid` ไม่อยู่ในชุดที่แคชไว้ | `kid`, `knownKids` |
| `jwt.verification.success` | ตรวจ token ผ่าน | `sub`, `coreRole`, `subsystemRole` |
| `jwt.verification.failure` | ตรวจ token ไม่ผ่าน — รวมถึง callback ที่ state ไม่ผ่าน | `reason`, `kid`, `path` |
| `authorization.role_mapping_failed` | role ที่แมปไม่ได้ | `sub`, `coreRole` |
| `authorization.denied` | สิทธิ์ไม่พอ | `sub`, `subsystemRole`, `required`, `reason`, `path` |

ตัวอย่าง:

```json
{"event":"jwt.verification.failure","reason":"expired","kid":"core-hub-2026","path":"/api/v1/me","at":"2026-09-11T05:00:00.000Z"}
```

## 2. `reason` ที่ใช้ได้ (รายการปิด)

ตรวจ token ไม่ผ่าน ([`auth-contract.md`](auth-contract.md) ข้อ 4):

```text
missing_token · malformed_token · unsupported_algorithm · missing_kid · unknown_kid
jwks_unavailable · invalid_signature · expired · invalid_issuer · invalid_audience · invalid_claims
token_lifetime_exceeded (ขั้น 9) · invalid_azp (ขั้น 10)
```

callback ที่ state ไม่ผ่าน (auth-contract ข้อ 5.1) — ใช้กับ event `jwt.verification.failure` ที่ `path` = `/auth/callback`:

```text
sso_restart_without_state · sso_state_missing · sso_state_mismatch
```

## 3. ห้าม log เด็ดขาด

```text
access token · refresh token · header Authorization · header Cookie ทั้งก้อน · รหัสผ่าน · กุญแจส่วนตัว
URL เต็มของ /auth/callback · URL ที่มี query string ใด ๆ · ชื่อ อีเมล หรือข้อมูลบุคคลอื่น
```

- ถ้าต้องอ้างถึง token ให้ log เฉพาะ `kid` และ `sub` เท่านั้น — ระบุตัวผู้ใช้ด้วย `sub` อย่างเดียว
- logger กลาง · error filter · request logger ทุกตัว log **`path` ไม่มี query** (Express: `request.path` ไม่ใช่ `request.url`)
  เพราะ query ของ `/auth/callback` มี token และ query ของการค้นหาอาจมีชื่อคน

## 4. ตรวจอย่างไร

```bash
# ยิงทั้งเคสสำเร็จและเคสล้มเหลว (รวม login ผ่าน SSO หนึ่งรอบ) แล้วค้นใน log ต้องไม่พบอะไรเลย
docker compose logs backend | grep -iE "eyJ|access_token=|authorization:|cookie:" | head
```
