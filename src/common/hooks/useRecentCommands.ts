import { useCallback, useMemo } from 'react';
import { CommandType } from '../constants/commands';

const STORAGE_KEY = 'herocast_recent_commands';
const MAX_RECENT_COMMANDS = 10;
const MAX_AGE_DAYS = 30;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

interface StoredCommand {
  commandName: string;
  lastUsed: number;
  frequency: number;
}

interface RecentCommand extends StoredCommand {
  score: number;
}

// Check if we're on the client side
const isClient = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const useRecentCommands = () => {
  // Get stored commands from localStorage
  const getStoredCommands = useCallback((): StoredCommand[] => {
    if (!isClient) return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const commands: StoredCommand[] = JSON.parse(stored);
      const now = Date.now();
      
      // Filter out commands older than 30 days
      return commands.filter(cmd => now - cmd.lastUsed < MAX_AGE_MS);
    } catch (error) {
      console.error('Error reading recent commands:', error);
      return [];
    }
  }, []);

  // Save commands to localStorage
  const saveCommands = useCallback((commands: StoredCommand[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
    } catch (error) {
      console.error('Error saving recent commands:', error);
    }
  }, []);

  // Add a command to history
  const addCommand = useCallback((command: CommandType) => {
    const commands = getStoredCommands();
    const existingIndex = commands.findIndex(cmd => cmd.commandName === command.name);
    
    if (existingIndex !== -1) {
      // Update existing command
      commands[existingIndex].lastUsed = Date.now();
      commands[existingIndex].frequency += 1;
    } else {
      // Add new command
      commands.push({
        commandName: command.name,
        lastUsed: Date.now(),
        frequency: 1,
      });
    }
    
    // Sort by score and keep only top N commands
    const scored = commands.map(cmd => ({
      ...cmd,
      score: calculateScore(cmd.lastUsed, cmd.frequency),
    }));
    
    scored.sort((a, b) => b.score - a.score);
    const topCommands = scored.slice(0, MAX_RECENT_COMMANDS);
    
    saveCommands(topCommands);
  }, [getStoredCommands, saveCommands]);

  // Get recent commands with scores
  const getRecentCommands = useCallback((): RecentCommand[] => {
    const commands = getStoredCommands();
    
    return commands
      .map(cmd => ({
        ...cmd,
        score: calculateScore(cmd.lastUsed, cmd.frequency),
      }))
      .sort((a, b) => b.score - a.score);
  }, [getStoredCommands]);

  // Clear command history
  const clearHistory = useCallback(() => {
    if (!isClient) return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing command history:', error);
    }
  }, []);

  // Get command names only (for quick lookup)
  const recentCommandNames = useMemo(() => {
    return getRecentCommands().map(cmd => cmd.commandName);
  }, [getRecentCommands]);

  return {
    addCommand,
    getRecentCommands,
    clearHistory,
    recentCommandNames,
    calculateScore,
  };
};

// Scoring function that combines recency and frequency
// Exported for testing and external use
export const calculateScore = (lastUsed: number, frequency: number): number => {
  const now = Date.now();
  const ageInDays = (now - lastUsed) / (24 * 60 * 60 * 1000);
  
  // Recency score: exponential decay over 30 days
  // Score is 1.0 for today, ~0.5 for 7 days ago, ~0.1 for 30 days ago
  const recencyScore = Math.exp(-ageInDays / 10);
  
  // Frequency score: logarithmic growth to prevent one command from dominating
  // Score is 0 for frequency 1, ~0.69 for frequency 2, ~1.1 for frequency 3, etc.
  const frequencyScore = Math.log(frequency);
  
  // Combined score with weights
  // Recency is weighted more heavily (70%) than frequency (30%)
  return recencyScore * 0.7 + frequencyScore * 0.3;
};