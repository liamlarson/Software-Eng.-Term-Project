/* tslint:disable */
import Log from "../Util";
import {InsightError} from "./IInsightFacade";
import DatasetHandler from "./DatasetHandler";
import QueryValidator from "./QueryValidator";
import Decimal from "decimal.js";
import TransformationValidator from "./TransformationValidator";
export default class Transformer {
    private toString = Object.prototype.toString;
    public static group(filtered: object[], query: any): object[] {
        try {
            let grouped: any = {};
            let applyKeys = Transformer.getApplyData(query["TRANSFORMATIONS"]["APPLY"]);
            let groups: string[] = query["TRANSFORMATIONS"]["GROUP"];
            for (let section of filtered) {
                let groupSection: string = "";
                for (let group in groups) {
                    let input: string = groups[group];
                    groupSection = Transformer.makeGroupSection(input, section, groupSection);
                }
                if (!grouped[groupSection]) {
                    let toAdd: any = {};
                    for (let group in groups) {
                        let input: string = groups[group];
                        toAdd[groups[group]] = QueryValidator.getKeyData(input, section);
                    }
                    grouped[groupSection] = toAdd;
                }
                if (applyKeys.length !== 0) {
                    for (let AItem of applyKeys) {
                        let group: any = grouped[groupSection];
                        if (group[AItem[0]] || group[AItem[0] + ";count"]) {
                            let input: string = AItem[2] ; let value = QueryValidator.getKeyData(input, section);
                            group = Transformer.doTransformations(group, value, AItem);
                        } else { // applyItem not added
                            let input: string = AItem[2] ; let value = QueryValidator.getKeyData(input, section);
                            if (AItem[1] !== "COUNT") {
                                if (AItem[1] === "AVG") {
                                    let num = new Decimal(value * 10);
                                    group[AItem[0]] = num;
                                    group[AItem[0] + ";avg"] = 1;
                                } else {
                                    if(AItem[1] === "SUM"){
                                        value = Number(value.toFixed(2));
                                    }
                                    group[AItem[0]] = value;
                                }
                            } else {
                                group[AItem[0] + ";count"] = {};
                                group[AItem[0] + ";count"][value] = 1;
                            }
                        }
                    }
                }
            }
            return Transformer.CountAndAverageFinalization(grouped);

        } catch (e) {
            throw(new InsightError("Grouping issue"));
        }
    }

    public static doTransformations(group: any, value: any, applyItem: any): any {
        switch (applyItem[1]) {
            case "MAX": {
                if (value > group[applyItem[0]]) {
                    group[applyItem[0]] = value;
                }
                break;
            }
            case "MIN": {
                if (value < group[applyItem[0]]) {
                    group[applyItem[0]] = value;
                }
                break;
            }
            case "SUM": {
                let bal = group[applyItem[0]];
                bal = Number(bal.toFixed(2));
                value = value + bal;
                value = Number(value.toFixed(2));
                group[applyItem[0]] = value ;
                break;
            }
            case "COUNT": {
                if (!group[applyItem[0] + ";count"][value]) {
                    group[applyItem[0] + ";count"][value] = 1;
                }
                break;
            }
            case "AVG": {
                let num: number = 10 * value;
                let dec = new Decimal(num);
                let valu = new Decimal(group[applyItem[0]]);
                let addition = valu.add(num);
                group[applyItem[0]] = addition;
                group[applyItem[0] + ";avg"] += 1;
            }
        }
        return group;
    }

    public static CountAndAverageFinalization(grouped: any): Array<{}> {
        let toReturn: Array<{}> = new Array();
        for (let groupKey in grouped) {
            let group = grouped[groupKey];
            for (let key in group) {
                if (key.includes(";avg")) {
                    let avgKey = key.substring(0, key.indexOf(";"));
                    let count = group[key];
                    let avg = group[avgKey];
                    avg = avg / count;
                    avg = avg / 10;
                    avg = Number(avg.toFixed(2));
                    group[avgKey] = avg;
                    delete group[key];
                }
                if (key.includes(";count")) {
                    let countKey = key.substring(0, key.indexOf(";"));
                    let count = Object.keys(group[key]).length;
                    group[countKey] = count;
                    delete group[key];
                }
            }
            toReturn.push(group);
        }
        console.log(toReturn);
        return toReturn;
    }
    public static makeGroupSection(group: any, section: any, groupSection: any): any {
        let input: string = Object.keys(group)[0] ;
        let value = QueryValidator.getKeyData(group, section);
        groupSection += ( value + "~");
        return groupSection;
    }
    public static getApplyData(apply: any): Array<[string, string, string]> {
        let toReturn: Array<[string, string, string]> = new Array<[string, string, string]>() ;
        for (let applyObj of apply) {
            let newKey: string;
            let op: string;
            let key: string;
            for (let val in applyObj) {
                newKey = val;
                for (let obj in applyObj[val]) {
                    op = obj;
                    key = applyObj[val][obj];
                }
            }
            toReturn.push([newKey, op, key]);
        }
        return toReturn;
    }
    public static sort(sections: object[], options: any): Promise<object[]> {
        return new Promise( (resolve, reject) => {
            try {
                if (options["ORDER"] !== undefined) {
                    let crit: any = options["ORDER"];
                    if (toString.call(crit) === "[object Object]" ) {
                        let direction = crit["dir"];
                        let dir: number;
                        if (direction === "UP") {
                            dir = 1;
                        } else {
                            dir = -1;
                        }
                        resolve(sections.sort(Transformer.directionSort(crit["keys"], dir)));
                    }
                    // "_avg", "_pass", "_fail", "_audit"
                    crit = crit.substring(crit.indexOf("_") , );
                    if ( crit === "_avg" || crit === "_pass"
                        || crit === "_fail" || crit === "_audit" || crit === "_year"
                        || crit === "_lat" || crit === "_lon" || crit === "_seats") {
                        resolve(sections.sort( (a: object, b: object) => {
                            let va =  QueryValidator.getKeyData(crit, a);
                            let vb =  QueryValidator.getKeyData(crit, b);
                            return va - vb;
                        }));
                    } else {
                        resolve(sections.sort((a: object, b: object) => {
                            let va =  QueryValidator.getKeyData(crit, a);
                            let vb =  QueryValidator.getKeyData(crit, b);
                            if (va > vb) {return 1; }
                            if (va < vb) {return -1; }
                            return 0;
                        }));
                    }
                } else {
                    resolve(sections);
                }
            } catch (e) {
                reject(new InsightError("Sorting error"));
            }
        });
    }

    public static directionSort(keys: any, direction: number): any {
        return function (a: object, b: object) {
            for ( let key of keys) {
                let va = QueryValidator.getKeyData(key, a);
                let vb = QueryValidator.getKeyData(key, b);
                if (QueryValidator.checkNumKey(key)) {
                    let returnVal: number = direction * (va - vb);
                    if (returnVal !== 0) { return returnVal; }
                } else {
                    if (va > vb) { return direction; }
                    if (va < vb) { return -1 * direction; }
                }
            }
        };
    }
    public static columnFilter(sections: object[], columns: string[], query: any): Promise<Array<{}>> {
        return new Promise( (resolve, reject) => {
            let toReturn: Array<{}> = [];
            for (let section of sections) {
                let obj: any = {};
                let customKeys: string [];
                if ("TRANSFORMATIONS" in query) {
                    customKeys = TransformationValidator.getApplyKeys(query["TRANSFORMATIONS"]);
                }
                for (let temp of columns) {
                    if (( section as any)[temp]) {
                        obj[temp] = ( section as any)[temp]; } else {
                        obj[temp] = QueryValidator.getKeyData(temp, section);
                    }
                }
                toReturn.push(obj);
            }
            resolve(toReturn);
        });
    }
}
