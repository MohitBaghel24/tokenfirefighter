export const ollamaAdapter = {
  id: 'ollama',
  name: 'Ollama',
  defaultConfigPath() {
    return 'N/A (Uses environment variables)';
  },
  updateConfig(filePath: string, proxyUrl: string, dryRun: boolean) {
    return {
      success: true,
      summary: `Ollama is configured via environment variables. To route your applications' Ollama traffic through TokenFirefighter:

1. Point your client applications / SDKs targeting Ollama to:
     "${proxyUrl}" (instead of the default http://localhost:11434)
2. Ensure you route requests to the proxy using the X-TokenFirefighter-Target header if using other client tools:
     X-TokenFirefighter-Target: http://localhost:11434`
    };
  }
};
