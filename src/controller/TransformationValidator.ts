import Log from "../Util";
import {InsightError} from "./IInsightFacade";
import DatasetHandler from "./DatasetHandler";
import QueryValidator from "./QueryValidator";
export default class TransformationValidator {
    public static validateApply(apply: any): boolean {
        if (toString.call(apply) !== "[object Array]")  {return false; }
        for (let key of apply) {
            let answer: boolean = TransformationValidator.validateApplyKeys(key, apply);
            if (!answer) { return false; }
        }
        if (Object.keys(apply).length < 1) {
            return false;
        }
        return true;
    }
    public static validateApplyKeys(keys: any, apply: any): boolean {
        for (let key in keys) {
            if (typeof key !== "string") {return false; }
            if (key.includes("_")) {return false; }
        }
        for (let token in keys) {
            if (!TransformationValidator.checkToken(keys[token])) {return false; }
        }
        return true;
    }
    public static checkToken(applyToken: any): boolean {
        for (let token in applyToken) {
            if (!((token === "MAX") || (token === "MIN") || (token === "COUNT") || (token === "AVG")
                || (token === "SUM"))) {return false; }
            if (token === "MAX" || token === "MIN" || token === "AVG" || token === "SUM") {
                for (let keyValKey in applyToken) {
                    let keyVal = applyToken[keyValKey];
                    // "_avg", "_pass", "_fail", "_audit", "_year", "_lat", "_lon", "_seats"
                    if (!QueryValidator.checkNumKey(keyVal)) {return false; }
                }
            }
        }
        return true;
    }
    public static checkTransCol(query: any): boolean {
        let allValid: boolean = true;
        let customKeys: string[] = TransformationValidator.getApplyKeys(query["TRANSFORMATIONS"]);
        let columns = query["OPTIONS"]["COLUMNS"];
        for (let key of columns) {
            let validtranskey: boolean = false;
            if (!QueryValidator.checkKey(key)) {
                for (let custKey of customKeys) {
                    if (custKey === key) {
                        validtranskey = true;
                    }
                }
            } else {
                validtranskey = true;
            }
            allValid = validtranskey;
        }
        return allValid;
    }
    public static checkOrderKey(query: any): boolean {
        let allValid: boolean = true;
        let customKeys: string[];
        if (query["TRANSFORMATIONS"]) {
            customKeys  = TransformationValidator.getApplyKeys(query["TRANSFORMATIONS"]);
        }
        let keys: any = [];
        let key: string;
        if (query["OPTIONS"]["ORDER"]["keys"]) {
            keys = query["OPTIONS"]["ORDER"]["keys"];
            for (let crit of keys) {
                let validtranskey: boolean = false;
                if (!QueryValidator.checkKey(crit)) {
                    for (let custKey of customKeys) {
                        if (custKey === crit) {
                            validtranskey = true;
                        }
                    }
                } else {
                    validtranskey = true;
                }
                allValid = validtranskey;
            }
            return allValid;
        } else {
            key = query["OPTIONS"]["ORDER"];
            let validtranskey: boolean = false;
            if (!QueryValidator.checkKey(key)) {
                for (let custKey of customKeys) {
                    if (custKey === key) {
                        validtranskey = true;
                    }
                }
            } else {
                validtranskey = true;
            }
            allValid = validtranskey;
            return allValid;
        }
    }
    public static getApplyKeys(transformations: any): string[] {
        let customKeys: string[] = [];
        for (let applygroup of transformations["APPLY"]) {
            for (let applyitem in applygroup) {
                if (customKeys.includes(applyitem)) {
                    throw(new InsightError("duplicate keys in Apply"));
                }
                customKeys.push(applyitem);
            }
        }
        return customKeys;
    }
}
