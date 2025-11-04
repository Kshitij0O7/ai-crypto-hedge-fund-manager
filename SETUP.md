# Setup and Testing Guide

## Quick Test

To test the terminal interface with risk profile selection:

```bash
# Test with High Risk profile (option 1)
echo "1" | npm start

# Test with Low Risk profile (option 2)
echo "2" | npm start

# Or run interactively
npm start
```

## Expected Output

When you select option 1 (High Risk High Returns):
```
Enter any digit 1 or 2: 1

Checking the high risk coins...
```

When you select option 2 (Low Risk Low Returns):
```
Enter any digit 1 or 2: 2

Checking the low risk coins...
```

## Files

1. **src/ui/terminal.js**: Terminal user interface
2. **index.js**: Main application entry point
3. **src/services/bitquery.js**: Bitquery API client
4. **package.json**: Project configuration

