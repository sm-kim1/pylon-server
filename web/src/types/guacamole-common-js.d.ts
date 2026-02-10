declare module 'guacamole-common-js' {
  namespace Guacamole {
    class Tunnel {
      state: number;
      onstatechange: ((state: number) => void) | null;
      oninstruction: ((opcode: string, args: string[]) => void) | null;
      onerror: ((status: Status) => void) | null;

      connect(data: string): void;
      sendMessage(...elements: unknown[]): void;
      disconnect(): void;

      static readonly State: {
        readonly CONNECTING: 0;
        readonly OPEN: 1;
        readonly CLOSED: 2;
        readonly UNSTABLE: 3;
      };
    }

    class Client {
      constructor(tunnel: Tunnel);
      connect(data?: string): void;
      disconnect(): void;
      getDisplay(): Display;
      sendKeyEvent(pressed: number, keysym: number): void;
      sendMouseState(state: Mouse.State): void;
      sendSize(width: number, height: number): void;
      onstatechange: ((state: number) => void) | null;
      onerror: ((error: Status) => void) | null;
    }

    class Display {
      getElement(): HTMLElement;
      getWidth(): number;
      getHeight(): number;
      scale(scale: number): void;
    }

    class Keyboard {
      constructor(element: HTMLElement | Document);
      onkeydown: ((keysym: number) => void) | null;
      onkeyup: ((keysym: number) => void) | null;
    }

    class Mouse {
      constructor(element: HTMLElement);
      onmousedown: ((state: Mouse.State) => void) | null;
      onmouseup: ((state: Mouse.State) => void) | null;
      onmousemove: ((state: Mouse.State) => void) | null;
    }

    namespace Mouse {
      class State {
        x: number;
        y: number;
        left: boolean;
        middle: boolean;
        right: boolean;
        up: boolean;
        down: boolean;
      }
    }

    class Status {
      code: number;
      message: string;
      constructor(code: number, message?: string);
      isError(): boolean;
    }
  }

  export default Guacamole;
}
