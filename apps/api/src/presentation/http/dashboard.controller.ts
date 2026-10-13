import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { dashboardPeriodSchema } from '@mon-cher-savon/contracts';
import { GetDashboardUseCase } from '../../application/dashboard.use-case.js';
import { AdminGuard } from './admin.guard.js';

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(@Inject(GetDashboardUseCase) private readonly dashboard: GetDashboardUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Números da loja no período (hoje, 7 dias ou mês)' })
  @ApiQuery({ name: 'period', enum: ['hoje', '7dias', 'mes'], required: false })
  get(@Query('period') period?: string) {
    return this.dashboard.execute(dashboardPeriodSchema.default('hoje').parse(period));
  }
}
