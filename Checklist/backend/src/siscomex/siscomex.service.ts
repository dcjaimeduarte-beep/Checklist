import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Repository } from 'typeorm';

import { WebFetchCacheEntity } from '../entities/web-fetch-cache.entity';

const MAX_SNIPPET = 8000;
const FETCH_TIMEOUT_MS = 25_000;
const MIN_USEFUL_LENGTH = 200; // Abaixo disso, tenta Playwright

@Injectable()
export class SiscomexService {
  private readonly logger = new Logger(SiscomexService.name);

  constructor(
    @InjectRepository(WebFetchCacheEntity)
    private readonly cacheRepo: Repository<WebFetchCacheEntity>,
  ) {}

  getPortalUrl(): string | undefined {
    const u = process.env.URL_SITE?.trim();
    return u && u.length > 0 ? u : undefined;
  }

  /**
   * Obtém texto legível do portal. Tenta axios+cheerio primeiro;
   * se o conteúdo for mínimo (SPA), usa Playwright headless como fallback.
   * Resultado cacheado em SQLite.
   */
  async fetchClassificationPortal(): Promise<{ url: string; snippet: string; fromCache: boolean }> {
    const url = this.getPortalUrl();
    if (!url) {
      return { url: '', snippet: '', fromCache: false };
    }

    /* Cache hit */
    const existing = await this.cacheRepo.findOne({ where: { url } });
    if (existing) {
      return { url, snippet: existing.bodySnippet, fromCache: true };
    }

    /* Tentar axios + cheerio (rápido, funciona para sites estáticos) */
    let snippet = '';
    try {
      snippet = await this.fetchWithAxios(url);
    } catch (e) {
      this.logger.warn(`Axios falhou para ${url}: ${String(e)}`);
    }

    /* Se conteúdo insuficiente, tentar Playwright (SPAs) */
    if (snippet.length < MIN_USEFUL_LENGTH) {
      this.logger.log('Conteúdo insuficiente via axios, tentando Playwright...');
      try {
        snippet = await this.fetchWithPlaywright(url);
      } catch (e) {
        this.logger.warn(`Playwright falhou: ${String(e)}`);
      }
    }

    if (!snippet) {
      snippet = 'Não foi possível obter conteúdo do portal. Verifique a URL e conectividade.';
    }

    /* Salvar no cache */
    await this.cacheRepo.save(
      this.cacheRepo.create({
        url,
        bodySnippet: snippet.slice(0, MAX_SNIPPET),
        fetchedAt: new Date(),
      }),
    );

    return { url, snippet: snippet.slice(0, MAX_SNIPPET), fromCache: false };
  }

  /** Fetch rápido com axios + cheerio (sites estáticos) */
  private async fetchWithAxios(url: string): Promise<string> {
    const res = await axios.get<string>(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent':
          'SevenReformaTributaria/1.0 (+https://localhost; integração classificação Siscomex)',
        Accept: 'text/html,application/xhtml+xml',
      },
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const html = typeof res.data === 'string' ? res.data : '';
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  }

  /** Fetch com Playwright headless (SPAs que precisam de JavaScript) */
  private async fetchWithPlaywright(url: string): Promise<string> {
    const { chromium } = await import('playwright-core');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

      /* Aguardar conteúdo renderizar */
      await page.waitForTimeout(3000);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      const text: string = await page.evaluate('(() => { const el = document.querySelector("main") || document.querySelector("#app") || document.body; return el?.innerText ?? ""; })()');

      return text.replace(/\s+/g, ' ').trim();
    } finally {
      await browser.close();
    }
  }
}
