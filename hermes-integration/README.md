# Hermes Integration for DealCannonMobile

This folder contains the integration between DealCannonMobile and the Hermes Agent Telegram bot.

## Usage

```bash
# Connect to Hermes
python hermes_connect.py --action connect

# Check status
python hermes_connect.py --action status

# List properties
python hermes_connect.py --action properties

# Send message about a property
python hermes_connect.py --action message --property "123 Main St, Miami, FL" --text "New distressed property alert"

# Analyze a property
python hermes_connect.py --action analyze --property "123 Main St, Miami, FL"
```

## Configuration

Edit `config.ini` to configure:
- Telegram bot token
- Google Sheet ID
- Property database settings

## Features

- Property discussion via Telegram
- Deal analysis automation
- Property count tracking
- Integration with Google Sheets database
