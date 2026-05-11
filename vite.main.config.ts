import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      __RPC_URL__: JSON.stringify(env.VITE_RPC_URL ?? ''),
    },
  };
});
