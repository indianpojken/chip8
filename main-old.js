// https://en.wikipedia.org/wiki/CHIP-8
// http://devernay.free.fr/hacks/chip8/C8TECH10.HTM
// https://betterprogramming.pub/master-bitwise-operations-in-10-minutes-7842c65608d7
// https://javascript.info/
// http://www.cs.columbia.edu/~sedwards/classes/2016/4840-spring/designs/Chip8.pdf
const REGISTER_COUNT = 16;
const STACK_SIZE = 16;
const MEMORY_SIZE = 4096; // 0x1000
const START_ADDRESS = 512; // 0x200

const FONT = new Uint8Array([
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0 to F
    0x20, 0x60, 0x20, 0x20, 0x70,
    0xF0, 0x10, 0xF0, 0x80, 0xF0,
    0xF0, 0x10, 0xF0, 0x10, 0xF0,
    0x90, 0x90, 0xF0, 0x10, 0x10,
    0xF0, 0x80, 0xF0, 0x10, 0xF0,
    0xF0, 0x80, 0xF0, 0x90, 0xF0,
    0xF0, 0x10, 0x20, 0x40, 0x40,
    0xF0, 0x90, 0xF0, 0x90, 0xF0,
    0xF0, 0x90, 0xF0, 0x10, 0xF0,
    0xF0, 0x90, 0xF0, 0x90, 0x90,
    0xE0, 0x90, 0xE0, 0x90, 0xE0,
    0xF0, 0x80, 0x80, 0x80, 0xF0,
    0xE0, 0x90, 0x90, 0x90, 0xE0,
    0xF0, 0x80, 0xF0, 0x80, 0xF0,
    0xF0, 0x80, 0xF0, 0x80, 0x80]);

const RESOLUTION_WIDTH = 64;
const RESOLUTION_HEIGHT = 32;

const DISPLAY_SCALE = 10;

const KEYPAD = {
    "KeyX": "0", "Digit1": "1", "Digit2": "2", "Digit3": "3",
    "KeyQ": "4", "KeyW": "5", "KeyE": "6", "KeyA": "7",
    "KeyS": "8", "KeyD": "9", "KeyZ": "A", "KeyC": "B",
    "Digit4": "C", "KeyR": "D", "KeyF": "E", "KeyV": "F"
}

class Chip8 {
    #canvas;

    constructor(canvas) {
        this.pc = START_ADDRESS;
        this.sp = 0;
        this.i = 0;

        this.v = new Uint8Array(REGISTER_COUNT);
        this.stack = new Uint16Array(STACK_SIZE);
        this.memory = new Uint8Array(MEMORY_SIZE);

        this.dt = 60;
        this.st = 60;

        this.display = new Array(RESOLUTION_HEIGHT).fill(0).map(() => new Array(RESOLUTION_WIDTH).fill(0));
        this.#canvas = canvas;

        this.input = new Input();

        for (let k in KEYPAD) {
            this.input.bindKey(k, KEYPAD[k]);
        }

        this.#loadFont(FONT);
    }

    run() {
        this.cycle();
        this.#render();
    }

    cycle() {
        let instruction = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];

        let opcode = (instruction & 0xf000) >> 12;

        let x = (instruction & 0x0f00) >> 8;
        let y = (instruction & 0x00f0) >> 4;
        let n = (instruction & 0x000f);
        let nn = (instruction & 0x00ff);
        let nnn = (instruction & 0x0fff);

        this.pc += 2;

        if (this.dt > 0) this.dt--;
        if (this.st > 0) this.st--;

        switch (opcode) {
            case 0x0:
                switch (instruction & 0x00ff) {
                    case 0xE0:
                        for (let yy in this.display) {
                            for (let xx in this.display[yy]) {
                                this.display[yy][xx] = 0;
                            }
                        }
                        break;
                    case 0xEE:
                        this.sp -= 1;
                        this.pc = this.stack[this.sp];
                        break;
                    default:
                        console.log("instruct not found : " + this.memory[this.pc].toString(16) + " " + this.memory[this.pc + 1].toString(16));
                }
                break;
            case 0x1:
                this.pc = nnn;
                break;
            case 0x2:
                this.stack[this.sp] = this.pc;
                this.sp += 1;
                this.pc = nnn;
                break;
            case 0x3:
                if (this.v[x] === nn) {
                    this.pc += 2;
                }
                break;
            case 0x4:
                if (this.v[x] !== nn) {
                    this.pc += 2;
                }
                break;
            case 0x5:
                if (this.v[x] === this.v[y]) {
                    this.pc += 2;
                }
                break;
            case 0x6:
                this.v[x] = nn;
                break;
            case 0x7:
                this.v[x] += nn;
                break;
            case 0x8:
                switch (instruction & 0x000f) {
                    case 0x0:
                        this.v[x] = this.v[y];
                        break;
                    case 0x1:
                        this.v[x] = this.v[x] | this.v[y];
                        break;
                    case 0x2:
                        this.v[x] = this.v[x] & this.v[y];
                        break;
                    case 0x3:
                        this.v[x] = this.v[x] ^ this.v[y];
                        break;
                    case 0x4: // unsure about this one
                        this.v[0xf] = ((this.v[x] + this.v[y]) > 255) ? 1 : 0;
                        this.v[x] = (this.v[x] + this.v[y]) & 0xff;
                        break;
                    case 0x5:
                        this.v[0xf] = (this.v[x] > this.v[y]) ? 1 : 0;
                        this.v[x] -= this.v[y];
                        break;
                    case 0x6: // unsure about this one. one source says to divide by 2 afterward, another does not.
                        this.v[0xf] = this.v[x] & 1;
                        this.v[x] >>= 1;
                        break;
                    case 0x7:
                        this.v[0xf] = (this.v[y] > this.v[x]) ? 1 : 0;
                        this.v[x] = this.v[y] - this.v[x];
                        break;
                    case 0xE:
                        this.v[0xf] = (this.v[x] >> 7) & 1;
                        this.v[x] <<= 1;
                        break;
                    default:
                        console.log("instruct not found : " + this.memory[this.pc].toString(16) + " " + this.memory[this.pc + 1].toString(16));
                }
                break;
            case 0x9:
                if (this.v[x] !== this.v[y]) {
                    this.pc += 2;
                }
                break;
            case 0xA:
                this.i = nnn;
                break;
            case 0xB:
                this.pc = nnn + this.v[0x0];
                break;
            case 0xC:
                this.v[x] = Math.floor(Math.random() * 256) & nn;
                break;
            case 0xD:
                for (let byte = 0; byte < n; byte++) {
                    let sprite = this.memory[this.i + byte];

                    for (let bit = 0; bit < 8; bit++) {
                        //let posx;
                        //let posy;

                        //if (this.v[y] + byte > 31) posy = (this.v[y] + byte) - 31;
                        //if (this.v[y] + byte < 0) posy = (this.v[y] + byte) + 31;
                        //else posy = this.v[y] + byte;

                        //if (this.v[x] + bit > 61) posx = (this.v[x] + bit) - 61;
                        //if (this.v[x] + bit < 0) {posx = (this.v[x] + bit) + 61; console.log(posx);}
                        //else posx = this.v[x] + bit;

                        this.v[0xf] = this.display[this.v[y] + byte][this.v[x] + bit] & 1;
                        this.display[this.v[y] + byte][this.v[x] + bit] ^= (sprite >> (7 - bit)) & 1;
                        //this.v[0xf] = this.display[posy][posx] & 1;
                        //this.display[posy][posx] ^= (sprite >> (7 - bit)) & 1;
                    }
                }
                break;
            case 0xE:
                switch (instruction & 0x00ff) {
                    case 0x9E:
                        if (this.input.keyDown(Object.values(KEYPAD)[this.v[x]])) this.pc += 2;
                        break;
                    case 0xA1:
                        if (!this.input.keyDown(Object.values(KEYPAD)[this.v[x]])) this.pc += 2;
                        break;
                    default:
                        console.log("opcodes : " + this.memory[this.pc].toString(16) + " " + this.memory[this.pc + 1].toString(16));
                }
                break;
            case 0xF:
                switch (instruction & 0x00ff) {
                    case 0x07:
                        this.v[x] = this.dt;
                        break;
                    case 0x0A:
                        if (this.input.keyDown("0")) this.v[x] = 0x0;
                        else if (this.input.keyDown("1")) this.v[x] = 0x1;
                        else if (this.input.keyDown("2")) this.v[x] = 0x2;
                        else if (this.input.keyDown("3")) this.v[x] = 0x3;
                        else if (this.input.keyDown("4")) this.v[x] = 0x4;
                        else if (this.input.keyDown("5")) this.v[x] = 0x5;
                        else if (this.input.keyDown("6")) this.v[x] = 0x6;
                        else if (this.input.keyDown("7")) this.v[x] = 0x7;
                        else if (this.input.keyDown("8")) this.v[x] = 0x8;
                        else if (this.input.keyDown("9")) this.v[x] = 0x9;
                        else if (this.input.keyDown("A")) this.v[x] = 0xA;
                        else if (this.input.keyDown("B")) this.v[x] = 0xB;
                        else if (this.input.keyDown("C")) this.v[x] = 0xC;
                        else if (this.input.keyDown("D")) this.v[x] = 0xD;
                        else if (this.input.keyDown("E")) this.v[x] = 0xE;
                        else if (this.input.keyDown("F")) this.v[x] = 0xF;
                        else this.pc -= 2;
                        break;
                    case 0x15:
                        this.dt = this.v[x];
                        break;
                    case 0x18:
                        this.st = this.v[x];
                        break;
                    case 0x1E:
                        this.i += this.v[x];
                        break;
                    case 0x29:
                        this.i = this.v[x] * 5;
                        break;
                    case 0x33:
                        console.log("not impl;");
                        break;
                    case 0x55:
                        for (let reg = 0; reg <= x; reg++) {
                            this.memory[this.i + reg] = this.v[reg];
                        }
                        this.i += x + 1;
                        break;
                    case 0x65:
                        for (let reg = 0; reg <= x; reg++) {
                            this.v[reg] = this.memory[this.i + reg]
                        }
                        this.i += x + 1;
                        break;
                    default:
                        console.log("instruct not found : " + this.memory[this.pc].toString(16) + " " + this.memory[this.pc + 1].toString(16));
                }
                break;
            default:
                console.log("opcodes : " + this.memory[this.pc].toString(16) + " " + this.memory[this.pc + 1].toString(16));
        }
    }

    loadRom(data) {
        for (let i = 0; i < data.length; i++) {
            this.memory[START_ADDRESS + i] = data[i];
        }
    }

    #loadFont(font) {
        for (let i = 0; i < font.length; i++) { // between 0x000 and 0x1ff
            this.memory[i] = font[i];
        }
    }

    #render() {
        this.#canvas.fillStyle = "black";
        this.#canvas.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

        for (let y in this.display) {
            for (let x in this.display[y]) {
                if (this.display[y][x] === 1) {
                    this.#canvas.fillStyle = "white";
                } else {
                    this.#canvas.fillStyle = "black";
                }
                this.#canvas.fillRect(x * DISPLAY_SCALE, y * DISPLAY_SCALE, 1 * DISPLAY_SCALE, 1 * DISPLAY_SCALE);
            }
        }
    }
}

class Input {
    #keybinds;
    #keys;

    constructor() {
        this.#keybinds = new Map();
        this.#keys = new Map();

        document.addEventListener("keydown", e => this.#handleKeyDown(e));
        document.addEventListener("keyup", e => this.#handleKeyUp(e));
    }

    bindKey(code, name) {
        this.#keybinds.set(code, name);
        this.#keys.set(name, false);
    }

    keyDown(keybind) {
        return this.#keys.get(keybind);
    }

    #handleKeyDown(event) {
        for (let k of this.#keybinds.keys()) {
            if (event.code === k) {
                this.#keys.set(this.#keybinds.get(k), true);
            }
        }
    }

    #handleKeyUp(event) {
        for (let k of this.#keybinds.keys()) {
            if (event.code === k) {
                this.#keys.set(this.#keybinds.get(k), false);
            }
        }
    }
}