import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';
import { RetrievalService } from './retrieval.service';

@Module({
  providers: [
    ChunkingService,
    EmbeddingService,
    VectorStoreService,
    RetrievalService,
  ],
  exports: [
    ChunkingService,
    EmbeddingService,
    VectorStoreService,
    RetrievalService,
  ],
})
export class RagModule {}
