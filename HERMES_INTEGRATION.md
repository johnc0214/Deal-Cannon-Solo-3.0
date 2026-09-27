# Hermes Agent Integration for DealCannonMobile

This repository now includes the Hermes Agent integration, enabling direct messaging between DealCannonMobile and the Hermes Telegram bot for property discussions and deal analysis.

## Setup

The Hermes integration has been added to DealCannonMobile. You can now:

- Message me directly about properties from DealCannonMobile
- Discuss property deals via Telegram
- Get automated analysis of properties
- Track property counts and statuses

## Usage

### List Properties
```bash
cd /opt/data/projects/DealCannonMobile
python hermes-messenger.py --list-properties
```

### Get Property Count
```bash
python hermes-messenger.py --property-count
```

### Analyze a Property
```bash
python hermes-messenger.py --analyze "123 Main St, City, State"
```

### Send Message
```bash
python hermes-messenger.py --message --address "123 Main St, City, State" --text "New distressed property alert"
```

## Production Database

The production Google Sheet used by DealCannonMobile:
- **Sheet ID:** `1QLzdEZwJEiOTk6UijCNmNrlt21XvCzBttrX_eLetAow3n6URo5FRKp4C`
- **Properties:** ~480 (479 real + 1 test property)
- **Link:** https://docs.google.com/spreadsheets/d/1QLzdEZwJEiOTk6UijCNmNrlt21XvCzBttrX_eLetAow3n6URo5FRKp4C/edit

## Next Steps

1. **Test the connection** - Run `python hermes-messenger.py --list-properties`
2. **Message me via Telegram** - Start discussing properties
3. **Import new properties** - Use the authorized Google Sheets API to import missing properties
4. **Remove test property** - Once production is verified, remove the test property (`99999 HERMES IMPORT TEST DR`)

## Notes

- The Hermes integration uses existing SSH authentication
- Google Sheets API access is already authorized
- No additional credentials needed for basic operations
- Property discussions happen via Telegram bot
