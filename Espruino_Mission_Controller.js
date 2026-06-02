var kb = require("USBKeyboard");

/*
LED1.toggle();

function blink() {
  LED1.toggle();
  LED2.toggle();
  setTimeout(blink, 500);
}

blink();
*/


const state = {
  a: false,
  b: false,
  up: false,
  down: false,
  left: false,
  right: false,
  enter: false
};

/*
const LED = B10;
digitalWrite(B13, 1); // GND
pinMode(LED, "output");
*/

function updateKeyboard() {
  const keys = [0,0,0,0,0,0];

  if (state.up) keys[0] = kb.KEY.UP;
  if (state.down) keys[0] = kb.KEY.DOWN;
  if (state.left) keys[1] = kb.KEY.LEFT;
  if (state.right) keys[1] = kb.KEY.RIGHT;
  if (state.a) keys[3] = kb.KEY.A;
  if (state.b) keys[4] = kb.KEY.B;
  if (state.enter) keys[5] = kb.KEY.ENTER;

  LED1.write(keys[2] || keys[3] || keys[4] || keys[5] ? true : false);
  LED2.write(keys[0] || keys[1] ? true : false);

  E.sendUSBHID([
    0, 0,
    keys[0],
    keys[1],
    keys[2],
    keys[3], 
    keys[4], 
    keys[5]
  ]);
}


/** JOYSTICK BUTTONS */
const JOYSTICK_BUTTON = B3;
pinMode(JOYSTICK_BUTTON, "input_pullup");

const JOYSTICK_X_PIN = A0;
const JOYSTICK_Y_PIN = A3;

// GRND to B10
digitalWrite(B10, 1);

const BUTTON_A = B13;
pinMode(BUTTON_A, "input_pulldown");

const BUTTON_B = B15;
pinMode(BUTTON_B, "input_pulldown");

// --- polling loop ---

const lastState = Object.assign({}, state);
setInterval(function () {
  // read current hardware state
  state.a = digitalRead(BUTTON_A);
  state.b = digitalRead(BUTTON_B);
  state.enter = !digitalRead(JOYSTICK_BUTTON);
  
  // x & y are inverted.
  const vert = analogRead(JOYSTICK_X_PIN);
  
  if ( vert < 0.3 ) {
    state.up = true;
    state.down = false;
  } else if ( vert > 0.7 ) {
    state.up = false;
    state.down = true;
  } else {
    state.up = false;
    state.down = false;
  }
  
  const horiz = analogRead(JOYSTICK_Y_PIN);
  if ( horiz < 0.3 ) {
    state.left = false;
    state.right = true;
  } else if ( horiz > 0.7 ) {
    state.left = true;
    state.right = false;
  } else {
    state.right = false;
    state.left = false;
  }
    

  // detect change
  const changed = JSON.stringify(state) !== JSON.stringify(lastState);

  if (changed) {
    Object.assign(lastState, state);
    updateKeyboard();
  }
}, 15); // 15ms debounce-ish polling interval


