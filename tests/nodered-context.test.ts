import { describe, test, expect, vi } from 'vitest';
import { createNodeRedPlugin } from '../src/plugins/nodered/index.js';
import type { NodeRedManager } from '../src/plugins/nodered/services/NodeRedManager.js';
import type { NodeRedState } from '../src/plugins/nodered/types.js';

interface ContextProvider {
  id: string;
  provide: () => string | Promise<string>;
}

interface RegisteredService {
  id: string;
  implementation: unknown;
}

interface TestHarness {
  provider: ContextProvider;
  manager: NodeRedManager;
}

function setupContext(): TestHarness {
  const plugin = createNodeRedPlugin();

  let capturedProvider: ContextProvider | undefined;
  let capturedManager: NodeRedManager | undefined;

  const mockContext = {
    getService: <TService,>(serviceId: string): TService | undefined => {
      if (serviceId === 'kernel.paths') {
        return { home: () => '/tmp/test-nodered' } as TService;
      }
      if (serviceId === 'kernel.events') {
        return { publish: vi.fn() } as TService;
      }
      if (serviceId === 'kernel.logger') {
        return {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as TService;
      }
      return undefined;
    },
    registerService: (service: RegisteredService) => {
      if (service.id === 'nodered.manager') {
        capturedManager = service.implementation as NodeRedManager;
      }
    },
    contributeStatusIndicator: () => {
      return () => {};
    },
    contributeContextProvider: (provider: ContextProvider) => {
      if (provider.id === 'nodered.context') {
        capturedProvider = provider;
      }
    },
    contributePromptSection: () => undefined,
    registerTool: () => undefined,
    registerCommand: () => undefined,
    registerHook: () => undefined,
    registerProvider: () => undefined,
    registerGatewayMethod: () => undefined,
    registerHttpRoute: () => undefined,
    registerChannel: () => undefined,
    dispatchHook: async (_domain: string, _event: string, payload: unknown) => ({
      initialPayload: payload,
      finalPayload: payload,
      failures: [],
    }),
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as never;

  plugin.setup(mockContext);

  if (!capturedProvider) {
    throw new Error('Context provider with id "nodered.context" was not registered during setup');
  }
  if (!capturedManager) {
    throw new Error('Service with id "nodered.manager" was not registered during setup');
  }

  return {
    provider: capturedProvider,
    manager: capturedManager,
  };
}

describe('nodered context provider', () => {
  test('returns empty string when state is disabled', () => {
    const { provider, manager } = setupContext();
    vi.spyOn(manager, 'getState').mockReturnValue('disabled' as NodeRedState);
    expect(provider.provide()).toBe('');
  });

  test('returns running status when state is running', () => {
    const { provider, manager } = setupContext();
    vi.spyOn(manager, 'getState').mockReturnValue('running' as NodeRedState);
    const result = provider.provide();
    expect(result).toContain('running');
    expect(result).not.toBe('');
  });

  test('returns non-empty message when state is stopped', () => {
    const { provider, manager } = setupContext();
    vi.spyOn(manager, 'getState').mockReturnValue('stopped' as NodeRedState);
    const result = provider.provide();
    expect(result).not.toBe('');
    expect(result).toContain('stopped');
  });

  test('returns non-empty message when state is starting', () => {
    const { provider, manager } = setupContext();
    vi.spyOn(manager, 'getState').mockReturnValue('starting' as NodeRedState);
    const result = provider.provide();
    expect(result).not.toBe('');
    expect(result).toContain('starting');
  });

  test('returns skill invocation message when state is setup-needed', () => {
    // TDD: fails until T012 changes provide()
    const { provider, manager } = setupContext();
    vi.spyOn(manager, 'getState').mockReturnValue('setup-needed' as NodeRedState);
    const result = provider.provide();
    expect(result).toMatch(/setup|install|skill/i);
    expect(result).not.toBe('');
    expect(result).not.toContain('currently setup-needed');
  });
});
