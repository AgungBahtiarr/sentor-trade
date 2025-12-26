import type { KillZone, TimeAnalysis } from '../../types/ict';

export class TimeAnalysisService {
  analyzeTime(): TimeAnalysis {
    const currentUTC = new Date();
    const currentHour = currentUTC.getUTCHours();
    const currentMinute = currentUTC.getUTCMinutes();

    const killZone = this.getKillZone(currentHour, currentMinute);
    const session = this.getSession(currentHour);

    return {
      killZone,
      currentUTC: currentUTC.toISOString(),
      session,
      tradingConditions: this.getTradingConditions(session, killZone.active),
    };
  }

  private getKillZone(hour: number, minute: number): KillZone {
    if (this.isInTimeRange(hour, minute, 0, 0, 3, 0)) {
      return {
        name: 'Asian',
        active: true,
        startTimeUTC: '00:00',
        endTimeUTC: '03:00',
        timeRemaining: this.getTimeRemaining(hour, minute, 3, 0),
        optimalEntry: minute <= 30,
      };
    }

    if (this.isInTimeRange(hour, minute, 7, 0, 10, 0)) {
      return {
        name: 'London',
        active: true,
        startTimeUTC: '07:00',
        endTimeUTC: '10:00',
        timeRemaining: this.getTimeRemaining(hour, minute, 10, 0),
        optimalEntry: minute <= 30,
      };
    }

    if (this.isInTimeRange(hour, minute, 12, 0, 15, 0)) {
      return {
        name: 'New York',
        active: true,
        startTimeUTC: '12:00',
        endTimeUTC: '15:00',
        timeRemaining: this.getTimeRemaining(hour, minute, 15, 0),
        optimalEntry: minute <= 30,
      };
    }

    return {
      name: 'None',
      active: false,
      startTimeUTC: '00:00',
      endTimeUTC: '00:00',
      timeRemaining: 0,
      optimalEntry: false,
    };
  }

  private isInTimeRange(
    currentHour: number,
    currentMinute: number,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number
  ): boolean {
    const currentTotal = currentHour * 60 + currentMinute;
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    return currentTotal >= startTotal && currentTotal < endTotal;
  }

  private getTimeRemaining(
    currentHour: number,
    currentMinute: number,
    endHour: number,
    endMinute: number
  ): number {
    const currentTotal = currentHour * 60 + currentMinute;
    const endTotal = endHour * 60 + endMinute;
    
    return endTotal - currentTotal;
  }

  private getSession(hour: number): 'Asian' | 'London' | 'New York' | 'Overlap' | 'Off-hours' {
    if (hour >= 0 && hour < 5) return 'Asian';
    if (hour >= 5 && hour < 8) return 'Off-hours';
    if (hour >= 8 && hour < 12) return 'London';
    if (hour >= 12 && hour < 16) return 'New York';
    if (hour >= 16 && hour < 17) return 'Off-hours';
    
    return 'Asian';
  }

  private getTradingConditions(
    session: string,
    killZoneActive: boolean
  ): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    if (killZoneActive) {
      return 'Excellent';
    }

    if (session === 'London' || session === 'New York') {
      return 'Good';
    }

    if (session === 'Asian') {
      return 'Fair';
    }

    return 'Poor';
  }

  isOptimalTradingTime(): { optimal: boolean; reason: string } {
    const analysis = this.analyzeTime();
    
    if (analysis.killZone.active && analysis.killZone.optimalEntry) {
      return {
        optimal: true,
        reason: `Currently in ${analysis.killZone.name} Kill Zone optimal entry window (${analysis.killZone.startTimeUTC}-${analysis.killZone.endTimeUTC} UTC)`,
      };
    }

    if (analysis.killZone.active) {
      return {
        optimal: true,
        reason: `Currently in ${analysis.killZone.name} Kill Zone (${analysis.killZone.startTimeUTC}-${analysis.killZone.endTimeUTC} UTC)`,
      };
    }

    if (analysis.tradingConditions === 'Good') {
      return {
        optimal: true,
        reason: `${analysis.session} session active - good trading conditions`,
      };
    }

    return {
      optimal: false,
      reason: `Off-hours or low volatility period. ${analysis.session} session - ${analysis.tradingConditions} trading conditions`,
    };
  }

  getNextKillZone(): { name: string; startsIn: number; startTime: string } | null {
    const currentUTC = new Date();
    const currentHour = currentUTC.getUTCHours();
    const currentMinute = currentUTC.getUTCMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    const killZones = [
      { name: 'Asian', startHour: 0, startMinute: 0 },
      { name: 'London', startHour: 7, startMinute: 0 },
      { name: 'New York', startHour: 12, startMinute: 0 },
    ];

    for (const kz of killZones) {
      const kzTotal = kz.startHour * 60 + kz.startMinute;
      
      if (kzTotal > currentTotal) {
        return {
          name: kz.name,
          startsIn: kzTotal - currentTotal,
          startTime: `${String(kz.startHour).padStart(2, '0')}:${String(kz.startMinute).padStart(2, '0')}`,
        };
      }
    }

    return {
      name: 'Asian',
      startsIn: (24 * 60) - currentTotal,
      startTime: '00:00',
    };
  }
}

export const timeAnalysisService = new TimeAnalysisService();
