import { Module } from '@nestjs/common';
import { LandingAiController } from './landing-ai.controller';
import { LandingAiCacheService } from './services/landing-ai-cache.service';
import { LandingAiClientService } from './services/landing-ai-client.service';
import { LandingAiSeedService } from './services/landing-ai-seed.service';
import { LandingAiService } from './services/landing-ai.service';

@Module({
  controllers: [LandingAiController],
  providers: [
    LandingAiClientService,
    LandingAiCacheService,
    LandingAiService,
    LandingAiSeedService,
  ],
  exports: [
    LandingAiService,
    LandingAiClientService,
    LandingAiCacheService,
    LandingAiSeedService,
  ],
})
export class LandingAiModule {}
