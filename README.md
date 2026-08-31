---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '69910f2e-fa01-4336-80c6-96a88da0868e'
  PropagateID: '69910f2e-fa01-4336-80c6-96a88da0868e'
  ReservedCode1: '2027e396-94f6-468b-bbee-37e2c84c163a'
  ReservedCode2: '2027e396-94f6-468b-bbee-37e2c84c163a'
---

# dsh-ppt-master

PPT Master skill packaged as a DeepSeek Harness (dsh) plugin.

## Overview

This plugin wraps the [PPT Master](https://github.com/hugohe3/ppt-master) skill
into a dsh-native skill provider. PPT Master is an AI-driven presentation
workflow that generates editable PPTX decks, SVG snapshots, fills native PPTX
templates, and enhances finished presentations.

## Installation

```bash
dsh plugin --profile web add link:<path-to-this-directory>
```

## Prerequisites

PPT Master requires **Python 3.10+** and several Python packages. Before using
the skill, install the dependencies:

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and configure your API keys for image generation
backends (optional, only needed if you want AI-generated images).

## Structure

```
dsh-ppt-master/
├── package.json          # dsh plugin manifest
├── cordis.patch.yml      # bundle patch config
├── index.js              # skill provider entry
├── requirements.txt      # Python dependencies
├── .env.example          # environment config template
├── skills/
│   └── ppt-master/
│       ├── SKILL.md      # skill definition (frontmatter + workflow)
│       ├── references/   # design references, palettes, visual styles
│       ├── scripts/       # Python scripts for PPTX generation
│       ├── templates/    # PPTX templates
│       └── workflows/    # routing and profile workflows
├── LICENSE
└── README.md
```

## License

MIT — see [LICENSE](./LICENSE) and the original
[PPT Master](https://github.com/hugohe3/ppt-master) repository.

