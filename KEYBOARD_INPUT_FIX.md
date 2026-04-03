# Keyboard And Input Fix Notes

This project had an Android chat composer bug where the input would:

- sit correctly at first
- move after focusing/unfocusing the keyboard
- sometimes stay lifted
- sometimes get overlapped by the keyboard

The final fix uses one stable layout strategy per platform.

## Root Cause

Android keyboard handling was inconsistent because multiple layout systems were competing:

- Android window resizing from `adjustResize`
- React Native `KeyboardAvoidingView`
- safe-area bottom padding

That combination caused the composer to end up in different resting positions after keyboard open/close cycles.

## Final Strategy

### iOS

Use `KeyboardAvoidingView` with:

- `behavior="padding"`

This keeps the composer attached to the top of the keyboard in the normal iOS way.

### Android

Do not rely on `KeyboardAvoidingView` movement.

Instead:

- listen for `keyboardDidShow`
- read `event.endCoordinates.height`
- apply that height as bottom padding to the chat content container

This makes the screen layout deterministic:

- when keyboard opens, the composer sits above it
- when keyboard closes, the composer returns to its original resting position

## Safe Area Handling

The composer footer uses different bottom spacing depending on state:

- iOS: `insets.bottom + base padding + extra bottom breathing room`
- Android with keyboard open: fixed small padding above keyboard
- Android with keyboard closed: `max(insets.bottom, base padding) + extra bottom breathing room`

This avoids:

- overlap with the home indicator / gesture area
- the composer looking glued to the screen edge
- the old "lift bug" after keyboard dismissal

## Files Updated

- `components/ChatScreen.tsx`
- `components/ChatInput.tsx`
- `app.json`
- `app.plugin.js`

## Behavior Summary

The chat composer now:

- stays in safe area when keyboard is hidden
- moves above the keyboard when focused
- returns to the same resting position after dismiss
- avoids fragile animation-based keyboard hacks

## Important Rule

For keyboard issues in this screen, prefer:

- one keyboard layout owner per platform

Avoid stacking multiple keyboard adjustment systems together unless absolutely necessary.
