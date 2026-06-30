import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ComparisonService,
  type SemanticMatrixCompareInput,
  type SemanticMatrixCompareResult,
} from './comparison.service';

@ApiTags('Comparison')
@Controller('comparison')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Post('semantic-matrix')
  @ApiOperation({
    summary:
      'Semantic LLM compare — granular TFS matrix vs executive BCP checklist',
  })
  async semanticMatrix(
    @Body() body: SemanticMatrixCompareInput,
  ): Promise<SemanticMatrixCompareResult> {
    return this.comparisonService.semanticMatrixCompare(body);
  }
}
