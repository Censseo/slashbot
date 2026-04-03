# Contract: nodered-setup Skill Frontmatter

## YAML Frontmatter Schema

```yaml
---
name: Node-RED Setup
description: Install, start, stop, and manage the Node-RED runtime for slashbot
metadata:
  {
    "slashbot": {
      "emoji": "🔴",
      "skillKey": "nodered-setup",
      "requires": {
        "bins": ["node"]
      }
    }
  }
userInvocable: true
disableModelInvocation: false
---
```

## Eligibility

- **Required binary**: `node` (Node.js >= 18.x)
- **No env vars required**: Skill uses no API keys
- **No OS restriction**: Works on all platforms
- **Bundled**: Source = `bundled`, resolved from `src/plugins/skills/bundled/nodered-setup/`

## Invocation

- **Model invocable**: Yes — bot can call `skill.run` with `name: "nodered-setup"`
- **User invocable**: Yes — `/skill run nodered-setup`
- **Task argument**: Optional — `"install"`, `"start"`, `"stop"`, `"restart"`, `"verify"` to target specific section
