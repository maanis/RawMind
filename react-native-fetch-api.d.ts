declare global {
  interface RequestInit {
    reactNative?: {
      textStreaming?: boolean;
    };
  }
}

declare module 'react-native-fetch-api' {
  export function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export {};
