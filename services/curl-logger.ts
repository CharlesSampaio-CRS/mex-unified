import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';

interface CurlRequest {
  timestamp: string;
  method: string;
  url: string;
  curl: string;
  hash: string; // Para identificar duplicatas
}

const STORAGE_KEY = '@cryptohub:curl_logs';
const MAX_LOGS = 50; // Limite de logs salvos

class CurlLogger {
  private requests: CurlRequest[] = [];
  private isEnabled: boolean = true;
  private requestHashes: Set<string> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Carrega requisições salvas do AsyncStorage
   */
  private async loadFromStorage() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.requests = JSON.parse(stored);
        // Reconstrói o Set de hashes
        this.requestHashes = new Set(this.requests.map(r => r.hash));
        console.log(`📋 Loaded ${this.requests.length} curl logs from storage`);
      }
    } catch (error) {
      console.error('Failed to load curl logs:', error);
    }
  }

  /**
   * Ativa/desativa o logging de curl
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Gera hash único para a requisição (para detectar duplicatas)
   */
  private generateHash(method: string, url: string, body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyStr}`;
  }

  /**
   * Converte uma requisição HTTP em comando curl limpo
   */
  private generateCurl(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: any
  ): string {
    let curl = `curl -X ${method.toUpperCase()} '${url}'`;

    // Adiciona apenas headers importantes (remove headers padrão do fetch)
    const importantHeaders = ['Authorization', 'Content-Type', 'Accept', 'X-API-Key'];
    Object.entries(headers).forEach(([key, value]) => {
      if (importantHeaders.some(h => key.toLowerCase() === h.toLowerCase())) {
        curl += ` \\\n  -H '${key}: ${value}'`;
      }
    });

    // Adiciona body se existir
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
    }

    return curl;
  }

  /**
   * Loga uma requisição (evita duplicatas)
   */
  async logRequest(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: any
  ) {
    if (!this.isEnabled) return;

    // Gera hash para detectar duplicatas
    const hash = this.generateHash(method, url, body);
    
    // Se já existe, não adiciona
    if (this.requestHashes.has(hash)) {
      console.log('📋 Curl já logado (duplicata ignorada):', method, url);
      return;
    }

    const curl = this.generateCurl(method, url, headers, body);
    
    const request: CurlRequest = {
      timestamp: new Date().toISOString(),
      method: method.toUpperCase(),
      url,
      curl,
      hash,
    };

    this.requests.push(request);
    this.requestHashes.add(hash);

    // Mantém apenas os últimos MAX_LOGS
    if (this.requests.length > MAX_LOGS) {
      const removed = this.requests.shift();
      if (removed) {
        this.requestHashes.delete(removed.hash);
      }
    }

    console.log('📋 Curl logged:', method, url);

    // Salva automaticamente após cada requisição
    await this.saveToStorage();
  }

  /**
   * Salva no AsyncStorage
   */
  private async saveToStorage() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.requests));
    } catch (error) {
      console.error('Failed to save curl logs:', error);
    }
  }

  /**
   * Gera o documento simples com apenas curls
   */
  generateSimpleCurls(): string {
    const now = new Date().toLocaleString('pt-BR');
    let output = `# API cURL Commands\n\n`;
    output += `Gerado em: ${now}\n`;
    output += `Total: ${this.requests.length} requisições únicas\n\n`;
    output += `---\n\n`;

    this.requests.forEach((req, index) => {
      const timestamp = new Date(req.timestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      output += `## ${index + 1}. ${req.method} - ${timestamp}\n\n`;
      output += `\`\`\`bash\n${req.curl}\n\`\`\`\n\n`;
    });

    return output;
  }

  /**
   * Gera apenas os comandos curl (sem formatação)
   */
  generateRawCurls(): string {
    return this.requests.map(req => req.curl).join('\n\n');
  }

  /**
   * Retorna todas as requisições
   */
  getRequests(): CurlRequest[] {
    return [...this.requests];
  }

  /**
   * Limpa todas as requisições
   */
  async clear() {
    this.requests = [];
    this.requestHashes.clear();
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Curl log cleared');
  }

  /**
   * Compartilha o log
   */
  async shareLog(): Promise<void> {
    try {
      const content = this.generateSimpleCurls();
      
      if (Platform.OS === 'web') {
        // No web, faz download
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-curls-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📥 Log downloaded');
      } else {
        // No mobile, usa Share API nativo
        await Share.share({
          message: content,
          title: 'API cURL Commands',
        });
        console.log('📤 Log shared');
      }
    } catch (error) {
      console.error('Failed to share log:', error);
    }
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    const methodCount = this.requests.reduce((acc, req) => {
      acc[req.method] = (acc[req.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.requests.length,
      methods: methodCount,
      oldest: this.requests[0]?.timestamp,
      newest: this.requests[this.requests.length - 1]?.timestamp,
    };
  }
}

// Instância singleton
export const curlLogger = new CurlLogger();
