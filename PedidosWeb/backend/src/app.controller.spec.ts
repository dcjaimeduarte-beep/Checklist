import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return ok (rota global /api/health no app)', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        service: 'analisesped-api',
      });
    });
  });
});
