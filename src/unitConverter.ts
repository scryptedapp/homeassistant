import { TemperatureUnit } from "@scrypted/sdk";

export enum UnitGroup {
    None = 'None',
    Temperature = 'Temperature',
    Speed = 'Speed',
    Length = 'Length',
    Pressure = 'Pressure',
}

export enum Unit {
    NONE = '',
    // Temperature
    // Actually Kelving is SI for temperature
    C = '°C',
    F = '°F',

    // Speed
    M_S = 'm/s',
    KM_H = 'km/h',
    MI_H = 'mph',

    // Length
    M = 'm',
    MM = 'mm',
    KM = 'km',
    IN = 'in',
    MI = 'mi',

    // Pressure
    PA = 'Pa',
    HPA = 'hPa',
    BAR = 'bar'
}

const siUnitMap: Record<UnitGroup, Unit> = {
    [UnitGroup.None]: Unit.NONE,
    [UnitGroup.Length]: Unit.M,
    [UnitGroup.Pressure]: Unit.PA,
    [UnitGroup.Temperature]: Unit.C,
    [UnitGroup.Speed]: Unit.M_S,
}

interface UnitData {
    unit: Unit;
    unitGroup: UnitGroup;
    factor?: number;
    conversionFormula?: string;
}

export class UnitConverter {
    static UNITS_MAP: Record<Unit, UnitData> = {
        [Unit.NONE]: {
            unit: Unit.NONE,
            unitGroup: UnitGroup.Temperature,
            factor: 1,
        },
        [Unit.C]: {
            unit: Unit.C,
            unitGroup: UnitGroup.Temperature,
            factor: 1,
        },
        [Unit.F]: {
            unit: Unit.F,
            unitGroup: UnitGroup.Temperature,
            conversionFormula: '{fromSi} ? ({value} * 1.8 + 32) : (({value} - 32) / 1.8)',
        },
        [Unit.M_S]: {
            unit: Unit.M_S,
            unitGroup: UnitGroup.Speed,
            factor: 1,
        },
        [Unit.KM_H]: {
            unit: Unit.KM_H,
            unitGroup: UnitGroup.Speed,
            factor: 0.277777777777778,
        },
        [Unit.MI_H]: {
            unit: Unit.MI_H,
            unitGroup: UnitGroup.Speed,
            factor: 0.447038888888889,
        },
        [Unit.M]: {
            unit: Unit.M,
            unitGroup: UnitGroup.Length,
            factor: 1,
        },
        [Unit.MM]: {
            unit: Unit.MM,
            unitGroup: UnitGroup.Length,
            factor: 0.001,
        },
        [Unit.KM]: {
            unit: Unit.KM,
            unitGroup: UnitGroup.Length,
            factor: 1000,
        },
        [Unit.IN]: {
            unit: Unit.IN,
            unitGroup: UnitGroup.Length,
            factor: 0.0254,
        },
        [Unit.MI]: {
            unit: Unit.MI,
            unitGroup: UnitGroup.Length,
            factor: 1609.34,
        },
        [Unit.PA]: {
            unit: Unit.PA,
            unitGroup: UnitGroup.Pressure,
            factor: 1,
        },
        [Unit.HPA]: {
            unit: Unit.HPA,
            unitGroup: UnitGroup.Pressure,
            factor: 0.01,
        },
        [Unit.BAR]: {
            unit: Unit.BAR,
            unitGroup: UnitGroup.Pressure,
            factor: 0.00001,
        },
    }

    static getUnit(
        unitSrc: UnitData | Unit | string | undefined,
    ): UnitData {
        if (!unitSrc) {
            unitSrc = UnitConverter.UNITS_MAP[Unit.NONE];
        }

        const unit =
            typeof unitSrc === 'string' ? unitSrc : unitSrc.unit;

        const unitData = UnitConverter.UNITS_MAP?.[unit];
        if (!unitData) {
            return {
                factor: 1,
                unit: unit as Unit,
                unitGroup: UnitGroup.None,
            };
        } else {
            return unitData;
        }
    }

    static siToLocal(
        siValue: number,
        unit: UnitData | Unit | undefined,
    ) {
        if (isNaN(siValue)) {
            return 0;
        }

        const unitData = UnitConverter.getUnit(unit);

        if (!unitData) {
            return siValue;
        }

        const value = unitData.conversionFormula ?
            eval(
                unitData.conversionFormula
                    .replaceAll('{fromSi}', 'true')
                    .replaceAll('{value}', String(siValue)),
            ) :
            siValue / unitData.factor;

        if (!isNaN(value)) {
            return value;
        } else {
            return 0;
        }
    }

    static localToSi(
        localValue: number,
        unit: UnitData | Unit | undefined,
    ) {
        const unitData = UnitConverter.getUnit(unit);

        if (!unitData) {
            return localValue;
        }

        const value = unitData.conversionFormula ?
            eval(
                unitData.conversionFormula
                    .replaceAll('{fromSi}', 'false')
                    .replaceAll('{value}', String(localValue)),
            ) :
            localValue * unitData.factor

        if (!isNaN(value)) {
            return value;
        } else {
            return 0;
        }
    }

    static getUnits(
        unit: UnitData | Unit | string | undefined,
    ) {
        const unitData = UnitConverter.getUnit(unit);

        if (!unitData) {
            return [];
        }

        const { unitGroup } = unitData;

        return Object.values(UnitConverter.UNITS_MAP)
            .filter(unit => unit.unitGroup === unitGroup && unit.unit)
            ?.map(unit => unit.unit);

    }
}
