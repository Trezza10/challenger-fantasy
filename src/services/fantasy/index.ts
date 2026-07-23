import { serviceConfig } from '../../config/services';
import { apiFantasyService } from './apiFantasyService';
import { mockFantasyService } from './mockFantasyService';

/** The one service instance pages consume; configuration chooses its implementation. */
export const fantasyService = serviceConfig.useMockServices ? mockFantasyService : apiFantasyService;
