import type { GameTypePlugin } from "./game-plugin.ts";

export class GameTypeRegistry {
  private plugins = new Map<string, GameTypePlugin>();

  register(plugin: GameTypePlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Game type already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  get(gameTypeId: string): GameTypePlugin {
    const plugin = this.plugins.get(gameTypeId);
    if (!plugin) {
      throw new Error(`Unknown game type: ${gameTypeId}`);
    }
    return plugin;
  }

  list(): GameTypePlugin[] {
    return [...this.plugins.values()];
  }
}
