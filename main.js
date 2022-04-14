const startAdress = 512; // 0x200

const font = [
    0xF0, 0x90, 0x90, 0x90, 0xF0,
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
    0xF0, 0x80, 0xF0, 0x80, 0x80,
];

const size = {
    registers: 16,
    stack: 16,
    memory: 4096,
};

const resolution = {
    width: 64,
    height: 32,
    scale: 10,
};

const opcodes = {
    cpu: undefined,
    display: undefined,
    input: undefined,

    op_00E0() {
        for (let y in this.display.buffer) {
            for (let x in this.display.buffer[y]) {
                this.display.buffer[y][x] = 0;
            }
        }
    },

    op_00EE() {
        this.cpu.sp -= 1;
        this.cpu.pc = this.cpu.stack[this.cpu.sp];
    },

    op_1nnn(nnn) {
        this.cpu.pc = nnn;
    },

    op_2nnn(nnn) {
        this.cpu.stack[this.cpu.sp] = this.cpu.pc;
        this.cpu.sp += 1;
        this.cpu.pc = nnn;
    },

    op_3xkk(x, kk) {
        if (this.cpu.v[x] === kk) this.cpu.pc += 2;
    },

    op_4xkk(x, kk) {
        if (this.cpu.v[x] !== kk) this.cpu.pc += 2;
    },

    op_5xy0(x, y) {
        if (this.cpu.v[x] === this.cpu.v[y]) this.cpu.pc += 2;
    },

    op_6xkk(x, kk) {
        this.cpu.v[x] = kk;
    },

    op_7xkk(x, kk) {
        this.cpu.v[x] += kk;
    },

    op_8xy0(x, y) {
        this.cpu.v[x] = this.cpu.v[y];
    },

    op_8xy1(x, y) {
        this.cpu.v[x] = this.cpu.v[x] | this.cpu.v[y];
    },

    op_8xy2(x, y) {
        this.cpu.v[x] = this.cpu.v[x] & this.cpu.v[y];
    },

    op_8xy3(x, y) {
        this.cpu.v[x] = this.cpu.v[x] ^ this.cpu.v[y];
    },

    op_8xy4(x, y) {
        // unsure about this one
        this.cpu.v[0xf] = ((this.cpu.v[x] + this.cpu.v[y]) > 255) ? 1 : 0;
        this.cpu.v[x] = (this.cpu.v[x] + this.cpu.v[y]) & 0xff;
    },

    op_8xy5(x, y) {
        this.cpu.v[0xf] = (this.cpu.v[x] > this.cpu.v[y]) ? 1 : 0;
        this.cpu.v[x] -= this.cpu.v[y];
    },

    op_8xy6(x, y) {
        // unsure about this one. one source says to divide by 2 afterward, another does not.
        this.cpu.v[0xf] = this.cpu.v[x] & 1;
        this.cpu.v[x] >>= 1;
    },

    op_8xy7(x, y) {
        this.cpu.v[0xf] = (this.cpu.v[y] > this.cpu.v[x]) ? 1 : 0;
        this.cpu.v[x] = this.cpu.v[y] - this.cpu.v[x];
    },

    op_8xyE(x, y) {
        this.cpu.v[0xf] = (this.cpu.v[x] >> 7) & 1;
        this.cpu.v[x] <<= 1;
    },

    op_9xy0(x, y) {
        if (this.cpu.v[x] !== this.cpu.v[y]) this.cpu.pc += 2;
    },

    op_Annn(nnn) {
        this.cpu.i = nnn;
    },

    op_Bnnn(nnn) {
        this.cpu.pc = nnn + this.cpu.v[0x0];
    },

    op_Cxkk(x, kk) {
        this.cpu.v[x] = Math.floor(Math.random() * 256) & kk;
    },

    op_Dxyn(x, y, n) {
        for (let byte = 0; byte < n; byte++) {
            let sprite = this.cpu.memory[this.cpu.i + byte];

            for (let bit = 0; bit < 8; bit++) {
                this.cpu.v[0xf] = this.display.buffer[this.cpu.v[y] + byte][this.cpu.v[x] + bit] & 1;
                this.display.buffer[this.cpu.v[y] + byte][this.cpu.v[x] + bit] ^= (sprite >> (7 - bit)) & 1;
            }
        }
    },

    op_Ex9E(x) {
        if (this.input.keyDown(this.cpu.v[x].toString(16))) {
            this.cpu.pc += 2;
        }
    },

    op_ExA1(x) {
        if (!this.input.keyDown(this.cpu.v[x].toString(16))) {
            this.cpu.pc += 2;
        }
    },

    op_Fx07(x) {
        this.cpu.v[x] = this.cpu.dt;
    },

    op_Fx0A(x) {
        let keyPressed = false; // I can't come up with a better solution, atm.

        keypad.forEach(key => {
            if (this.input.keyDown(key.keypad)) {
                this.cpu.v[x] = parseInt(key.keypad, 16);
                keyPressed = true;
            }
        });

        if (!keyPressed) this.cpu.pc -= 2;
    },

    op_Fx15(x) {
        this.cpu.dt = this.cpu.v[x];
    },

    op_Fx18(x) {
        this.cpu.st = this.cpu.v[x];
    },

    op_Fx1E(x) {
        this.cpu.i += this.cpu.v[x];
    },

    op_Fx29(x) {
        this.cpu.i = this.cpu.v[x] * 5;
    },

    op_Fx33(x) {
        // TODO: add
    },

    op_Fx55(x) {
        for (let reg = 0; reg <= x; reg++) {
            this.cpu.memory[this.cpu.i + reg] = this.cpu.v[reg];
        }

        this.cpu.i += x + 1;
    },

    op_Fx65(x) {
        for (let reg = 0; reg <= x; reg++) {
            this.cpu.v[reg] = this.cpu.memory[this.cpu.i + reg]
        }

        this.cpu.i += x + 1;
    },
};

class Chip8 {
    #opcodes;

    constructor() {
        this.cpu = {
            pc: startAdress,
            sp: 0,
            i: 0,

            v: new Uint8Array(size.registers),
            stack: new Uint16Array(size.stack),
            memory: new Uint8Array(size.memory),

            dt: 60,
            st: 60,
        };

        this.display = new Display();
        this.input = new Input();

        this.#opcodes = opcodes;
        this.#opcodes.cpu = this.cpu;
        this.#opcodes.display = this.display;
        this.#opcodes.input = this.input;

        this.#loadFont();
    }

    loadRom(data) {
        data.forEach((byte, i) => {
            this.cpu.memory[startAdress + i] = byte;
        });
    }

    #loadFont() {
        font.forEach((byte, i) => {
            this.cpu.memory[i] = byte;
        });
    }

    cycle() {
        const instruction = (this.cpu.memory[this.cpu.pc] << 8) | this.cpu.memory[this.cpu.pc + 1];
        const opcode = (instruction & 0xf000) >> 12;

        const error = `instruct not found : ${this.cpu.memory[this.cpu.pc].toString(16)} ${this.cpu.memory[this.cpu.pc + 1].toString(16)}`;

        const argument = {
            x: (instruction & 0x0f00) >> 8,
            y: (instruction & 0x00f0) >> 4,
            n: (instruction & 0x000f),
            kk: (instruction & 0x00ff),
            nnn: (instruction & 0x0fff)
        };

        this.cpu.pc += 2;

        if (this.cpu.dt > 0) this.cpu.dt -= 1;
        if (this.cpu.st > 0) this.cpu.st -= 1;

        switch (opcode) {
            case 0x0: {
                switch (instruction & 0x00ff) {
                    case 0xE0: { this.#opcodes.op_00E0(); break; }
                    case 0xEE: { this.#opcodes.op_00EE(); break; }
                    default: console.log(error);
                }
                break;
            }
            case 0x1: { this.#opcodes.op_1nnn(argument.nnn); break; }
            case 0x2: { this.#opcodes.op_2nnn(argument.nnn); break; }
            case 0x3: { this.#opcodes.op_3xkk(argument.x, argument.kk); break; }
            case 0x4: { this.#opcodes.op_4xkk(argument.x, argument.kk); break; }
            case 0x5: { this.#opcodes.op_5xy0(argument.x, argument.y); break; }
            case 0x6: { this.#opcodes.op_6xkk(argument.x, argument.kk); break; }
            case 0x7: { this.#opcodes.op_7xkk(argument.x, argument.kk); break; }
            case 0x8: {
                switch (instruction & 0x000f) {
                    case 0x0: { this.#opcodes.op_8xy0(argument.x, argument.y); break; }
                    case 0x1: { this.#opcodes.op_8xy1(argument.x, argument.y); break; }
                    case 0x2: { this.#opcodes.op_8xy2(argument.x, argument.y); break; }
                    case 0x3: { this.#opcodes.op_8xy3(argument.x, argument.y); break; }
                    case 0x4: { this.#opcodes.op_8xy4(argument.x, argument.y); break; }
                    case 0x5: { this.#opcodes.op_8xy5(argument.x, argument.y); break; }
                    case 0x6: { this.#opcodes.op_8xy6(argument.x, argument.y); break; }
                    case 0x7: { this.#opcodes.op_8xy7(argument.x, argument.y); break; }
                    case 0xE: { this.#opcodes.op_8xyE(argument.x, argument.y); break; }
                    default: console.log(error);
                }
                break;
            }
            case 0x9: { this.#opcodes.op_9xy0(argument.x, argument.y); break; }
            case 0xA: { this.#opcodes.op_Annn(argument.nnn); break; }
            case 0xB: { this.#opcodes.op_Bnnn(argument.nnn); break; }
            case 0xC: { this.#opcodes.op_Cxkk(argument.x, argument.kk); break; }
            case 0xD: { this.#opcodes.op_Dxyn(argument.x, argument.y, argument.n); break; }
            case 0xE: {
                switch (instruction & 0x00ff) {
                    case 0x9E: { this.#opcodes.op_Ex9E(argument.x); break; }
                    case 0xA1: { this.#opcodes.op_ExA1(argument.x); break; }
                    default: console.log(error);
                }
                break;
            }
            case 0xF: {
                switch (instruction & 0x00ff) {
                    case 0x07: { this.#opcodes.op_Fx07(argument.x); break; }
                    case 0x0A: { this.#opcodes.op_Fx0A(argument.x); break; }
                    case 0x15: { this.#opcodes.op_Fx15(argument.x); break; }
                    case 0x18: { this.#opcodes.op_Fx18(argument.x); break; }
                    case 0x1E: { this.#opcodes.op_Fx1E(argument.x); break; }
                    case 0x29: { this.#opcodes.op_Fx29(argument.x); break; }
                    case 0x33: { this.#opcodes.op_Fx33(argument.x); break; }
                    case 0x55: { this.#opcodes.op_Fx55(argument.x); break; }
                    case 0x65: { this.#opcodes.op_Fx65(argument.x); break; }
                    default: console.log(error);
                }
                break;
            }
            default: console.log(error);
        }
    }

    run() {
        this.cycle();
        this.display.render();
    }
}

class Display {
    constructor() {
        this.graphics = {
            canvas: document.querySelector("canvas"),
            context: document.querySelector("canvas").getContext("2d"),
        };

        this.buffer = new Array(resolution.height).fill(0).map(() =>
            new Array(resolution.width).fill(0)
        );

        this.graphics.canvas.width = 64 * resolution.scale;
        this.graphics.canvas.height = 32 * resolution.scale;
    }

    render() {
        for (let y in this.buffer) {
            for (let x in this.buffer[y]) {
                if (this.buffer[y][x]) {
                    this.graphics.context.fillStyle = "white";
                } else {
                    this.graphics.context.fillStyle = "black";
                }

                this.graphics.context.fillRect(
                    x * resolution.scale, y * resolution.scale,
                    resolution.scale, resolution.scale
                );
            }
        }
    }
}

const keypad = [
    { keycode: "Digit1", keypad: "1" },
    { keycode: "Digit2", keypad: "2" },
    { keycode: "Digit3", keypad: "3" },
    { keycode: "Digit4", keypad: "C" },

    { keycode: "KeyQ", keypad: "4" },
    { keycode: "KeyW", keypad: "5" },
    { keycode: "KeyE", keypad: "6" },
    { keycode: "KeyR", keypad: "D" },

    { keycode: "KeyA", keypad: "7", },
    { keycode: "KeyS", keypad: "8", },
    { keycode: "KeyD", keypad: "9", },
    { keycode: "KeyF", keypad: "E", },
    
    { keycode: "KeyZ", keypad: "A", },
    { keycode: "KeyX", keypad: "0", },
    { keycode: "KeyC", keypad: "B", },
    { keycode: "KeyV", keypad: "F", },
];

class Input {
    #keybinds;
    #keyState;

    constructor() {
        this.#keybinds = new Map();
        this.#keyState = new Map();

        document.addEventListener("keydown", e => this.#handleKeyDown(e));
        document.addEventListener("keyup", e => this.#handleKeyUp(e));

        keypad.forEach(key => {
            this.#bindKey(key.keycode, key.keypad)
        });
    }

    #bindKey(keycode, keypad) {
        this.#keybinds.set(keycode, keypad);
        this.#keyState.set(keypad, false);
    }

    keyDown(key) {
        return this.#keyState.get(key);
    }

    #handleKeyDown(event) {
        for (let k of this.#keybinds.keys()) {
            if (event.code === k) {
                this.#keyState.set(this.#keybinds.get(k), true);
            }
        }
    }

    #handleKeyUp(event) {
        for (let k of this.#keybinds.keys()) {
            if (event.code === k) {
                this.#keyState.set(this.#keybinds.get(k), false);
            }
        }
    }
}
