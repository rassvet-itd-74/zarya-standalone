/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}

// Preload API bridge -- declared at script (ambient) scope so all .ts files see it.
interface Window {
  electronAPI: {
    hasKey(): Promise<boolean>;
    createKey(password: string): Promise<string>;
    unlockKey(password: string): Promise<string>;
    exportKey(): Promise<boolean>;
    importKey(): Promise<boolean>;
  };
  configAPI: {
    read(): Promise<{ contractAddress: string; chainId: number } | null>;
    write(config: { contractAddress: string; chainId: number }): Promise<void>;
    test(): Promise<number>;
  };
  zaryaAPI: {
    read(fn: string, args: unknown[]): Promise<unknown>;
    write(fn: string, args: unknown[]): Promise<`0x${string}`>;
    waitTx(hash: `0x${string}`): Promise<unknown>;
    getLogs(eventName: string, fromBlock?: bigint): Promise<unknown[]>;
    watch(eventName: string): Promise<void>;
    unwatch(eventName: string): Promise<void>;
    chain(): Promise<{ blockNumber: string; chainId: number }>;
    balance(address: string): Promise<string>;
    checkOrgan(organCode: string, address: string): Promise<boolean>;
    onEvent(cb: (eventName: string, logs: unknown[]) => void): () => void;
  };
  tagsAPI: {
    read(): Promise<Array<{ code: string; organ?: string }>>;
    write(tags: Array<{ code: string; organ?: string }>): Promise<void>;
    exportTags(): Promise<boolean>;
    importTags(): Promise<Array<{ code: string; organ?: string }> | null>;
    resolve(code: string): Promise<string | null>;
  };
}
