# Contributing to OpenForge Edge

Thanks for helping build an offline repair copilot for the Right-to-Repair community. Contributions of code, device profiles, repair knowledge and Lemonade benchmarks are all welcome.

## Ways to help

| Contribution | Where | Notes |
|---|---|---|
| **Lemonade results** | Issue or PR to the README | Hardware, Lemonade version, model, time to first token, tokens/s, page-ingest time. See [Performance evaluation plan](README.md#-performance-evaluation-plan) |
| **Device profiles** | `lib/devices.ts`, `backend/starter.py`, `backend/knowledge.py` | Procedures, screw groups, starting test points, aliases |
| **Repair notes** | `data/manuals/<device-id>/*.md` | Sourced, in your own words (see below) |
| **Bug fixes and features** | Anywhere | Open an issue first for anything large |

## Development setup

Follow [Getting Started](README.md#%EF%B8%8F-getting-started) for the Docker stack, or [Local Development](README.md#-local-development-without-docker) for hot reload. Before opening a pull request:

```bash
npx tsc --noEmit
```

```bash
docker compose up -d --build
```

Then check the Bench UI at http://localhost:3000 and `GET /api/health`.

## Rules for repair knowledge

The copilot repeats what the knowledge base says, so accuracy matters more than volume.

- **Cite your source** in the front matter (`url:`, `reliability:`) and at the end of the file.
- **Write it in your own words.** Do not paste text from service manuals, paid boardview tools or guides whose licence doesn't allow it.
- **No proprietary files.** Schematics, boardview data and service manuals stay on your own bench (`data/manuals/**/private/` and PDFs are git-ignored).
- **No made-up values.** Only add voltages, diode readings or part numbers you have measured on a known-good board or found in a trusted source. Mark anything uncertain as "likely" or leave it out.
- **Placeholders** (`backend/starter.py`) are only for values defined by an interface standard (USB, HDMI, battery chemistry), never board-specific ones.

## Adding a device profile

1. Add a profile to `DEVICES` in `lib/devices.ts`: group, procedures and steps (with optional `onFail` suggestions), and screw groups with positions on the 100 × 160 drawing grid if you have them. Starter profiles can skip the drawing; technicians map screws with step photos.
2. Add the device's aliases to `DEVICE_ALIASES` in `backend/knowledge.py`. The key must match the profile `id` and the `data/manuals/<id>/` folder.
3. Add starting test points (and standard-based placeholders, if any) to `DEFAULT_POINTS` in `backend/starter.py`.
4. Add sourced notes to `data/manuals/<id>/` and run `docker compose exec backend python ingest.py`.

## Code style

- Match the surrounding code: TypeScript with Tailwind classes in the frontend, typed FastAPI and Pydantic in the backend.
- Keep comments rare and useful; explain why, not what.
- Large touch targets and high contrast in the Bench UI: it is used with gloves on and hands busy.

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
