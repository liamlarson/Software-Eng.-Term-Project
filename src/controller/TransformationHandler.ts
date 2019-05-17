import Log from "../Util";
import {InsightError} from "./IInsightFacade";
import {Decimal} from "decimal.js";

export default class TransformationHandler {

    public static transform (options: any, transformations: any, results: any, data: any) {
        if (!this.isValidGroup(options, transformations)) {
            throw new InsightError("Keys in COLUMNS must be in GROUP or APPLY when TRANSFORMATIONS is present");
        }
        let groups = this.getGroups(transformations.GROUP, results);
        groups = this.apply(transformations.APPLY, groups);
        return groups;
    }

    public static isValidGroup (options: any, transformations: any) {
        if (transformations.GROUP === undefined || transformations.APPLY === undefined) {
            throw new InsightError("TRANSFORMATION must include GROUP and APPLY");
        }

        for (let col of options.COLUMNS) {
            let found = false;

            if (transformations.GROUP.includes(col)) {
                found = true;
            }

            for (let apply of transformations.APPLY) {
                if (Object.keys(apply).includes(col)) {
                    found = true;
                }
            }
            if (!found) {
                return false;
            }
        }

        return true;
    }

    public static getGroups (groupKeys: any, results: any): any {
        if (groupKeys.length === 0) {
            throw new InsightError("GROUP must have keys");
        }
        let allGroups: any = [];
        for (let result of results) {
            let inserted = false;
            for (let group of allGroups) {
                let fullMatch = true;
                for (let key of groupKeys) {
                    if (group[0][key] !== result[key]) {
                        fullMatch = false;
                    }
                }
                if (fullMatch) {
                    inserted = true;
                    group.push(Object.assign({}, result));
                }
            }
            if (!inserted) {
                allGroups.push([Object.assign({}, result)]);
            }
        }

        return allGroups;
    }

    public static apply (rules: any, groups: any): any {
        if (!this.isValidApply(rules)) {
            throw new InsightError("Duplicate APPLY key avgSeats");
        }

        let calculatedGroups: any = [];

        for (let group of groups) {
            let values = new Map<string, any>();
            for (let rule of rules) {
                let colName = Object.keys(rule)[0];
                let calculation = rule[colName];
                let value;

                if (Object.keys(calculation)[0] === "MAX") {
                    value = this.applyMax(calculation, colName, group);
                }

                if (Object.keys(calculation)[0] === "MIN") {
                    value = this.applyMin(calculation, colName, group);
                }

                if (Object.keys(calculation)[0] === "AVG") {
                    value = this.applyAvg(calculation, colName, group);
                }

                if (Object.keys(calculation)[0] === "SUM") {
                    value = this.applySum(calculation, colName, group);
                }

                if (Object.keys(calculation)[0] === "COUNT") {
                    value = this.applyCount(calculation, colName, group);
                }
                values.set(colName, value);
            }
            let newJson = Object.assign({}, group[0]);
            for (let key of values.keys()) {
                newJson[key] = values.get(key);
            }
            calculatedGroups.push(newJson);
        }
        return calculatedGroups;
    }

    public static isValidApply (rules: any) {
        let keys = [];
        for (let rule of rules) {
            keys.push(Object.keys(rule)[0]);
        }
        for (let key of keys) {
            if (keys.indexOf(key) !== keys.lastIndexOf(key)) {
                return false;
            }
        }
        return true;
    }

    public static applyMax(calculation: any, colName: any, group: any): any {

        let max = Number.MIN_SAFE_INTEGER;
        for (let result of group) {
            let value = result[calculation["MAX"]];
            if (typeof value !== "number") {
                throw new InsightError("MAX can only be applied to a numeric");
            }
            if (value > max) {
                max = value;
            }
        }
        let newJson = Object.assign({}, group[0]);
        newJson[colName] = max;
        return max;
    }

    public static applyMin(calculation: any, colName: any, group: any) {
        let min = Number.MAX_SAFE_INTEGER;
        for (let result of group) {
            let value = result[calculation["MIN"]];
            if (typeof value !== "number") {
                throw new InsightError("MIN can only be applied to a numeric");
            }
            if (value < min) {
                min = value;
            }
        }
        let newJson = Object.assign({}, group[0]);
        newJson[colName] = min;
        return min;
    }

    public static applyAvg(calculation: any, colName: any, group: any) {
        let total = new Decimal(0);
        for (let result of group) {
            let value = result[calculation["AVG"]];
            if (typeof value !== "number") {
                throw new InsightError("AVG can only be applied to a numeric");
            }
            total = Decimal.add(total, value);
        }
        let avg = total.toNumber() / group.length;
        avg = Number(avg.toFixed(2));

        let newJson = Object.assign({}, group[0]);
        newJson[colName] = avg;
        return avg;

    }

    public static applySum(calculation: any, colName: any, group: any) {
        let sum = 0;
        for (let result of group) {
            let value = result[calculation["SUM"]];
            if (typeof value !== "number") {
                throw new InsightError("SUM can only be applied to a numeric");
            }
            sum += value;
        }

        let newJson = Object.assign({}, group[0]);
        return Number(sum.toFixed(2));
    }

    public static applyCount(calculation: any, colName: any, group: any) {
        let count = 0;
        let seen: any = [];
        for (let result of group) {
            let value = result[calculation["COUNT"]];

            if (!seen.includes(value)) {
                seen.push(value);
                count ++;
            }
        }
        let newJson = Object.assign({}, group[0]);
        newJson[colName] = count;
        return count;
    }
}
