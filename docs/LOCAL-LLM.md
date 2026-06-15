# Lokales LLM — Quickstart

Verbindung zum on-prem DGX-Spark-Cluster (vLLM, OpenAI-kompatibel).

**Voraussetzung:** im Adversign-Büro-LAN (oder per VPN drin). Privater Endpoint, von außen nicht erreichbar.

> **In courseneo:** Admin → Settings → Model & API → Provider = **DGX Spark (on-prem)**. Base URL, Modell und Token werden vorausgefüllt; nur „Save settings" drücken. (Die App hängt `/v1/chat/completions` an die Base-URL an, daher steht die Base-URL **ohne** `/v1`: `http://192.168.1.50:8000`.)

## Zugang

- Endpoint: `http://192.168.1.50:8000/v1`
- API-Key (Bearer, Pflicht): `<DGX_API_KEY>  # set in course-studio/.env (VITE_DGX_API_KEY)`
- Modell-Alias: `Qwen/Qwen2.5-72B-Instruct` (fest, nicht aendern)

> Token nicht in Slack/Mail posten. Er sperrt den Cluster gegen Fremdzugriff im LAN.

## Schnelltest

```bash
curl -H "Authorization: Bearer <DGX_API_KEY>  # set in course-studio/.env (VITE_DGX_API_KEY)" \
  http://192.168.1.50:8000/v1/models
```

Erwartung: JSON mit `Qwen/...`. `401` -> Token falsch. Timeout -> nicht im Netz/VPN.

## Aus Code (Python, OpenAI-SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://192.168.1.50:8000/v1",
    api_key="<DGX_API_KEY>  # set in course-studio/.env (VITE_DGX_API_KEY)",
)

resp = client.chat.completions.create(
    model="Qwen/Qwen2.5-72B-Instruct",
    messages=[{"role": "user", "content": "Sag Hallo"}],
)
print(resp.choices[0].message.content)
```

## Tier waehlen (optional)

Standard ist `heavy`. Per Header steuerbar:

- `X-LLM-Tier: fast` -> kleines schnelles Modell (4B), einfache Aufgaben
- `X-LLM-Tier: heavy` -> grosses Modell (30B-A3B), anspruchsvolle Generierung

Python: `OpenAI(..., default_headers={"X-LLM-Tier": "fast"})`.

> **Hinweis (courseneo):** Der `X-LLM-Tier`-Header wird vom Desktop-Client derzeit **nicht** gesetzt — es laeuft also `heavy`. Tier-Auswahl im UI ist als Folge-Feature geplant (erfordert das Durchreichen des Headers in `src-tauri/.../model.rs::call_model`).
