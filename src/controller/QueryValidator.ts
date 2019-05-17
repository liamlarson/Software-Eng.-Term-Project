import Log from "../Util";
import {InsightError} from "./IInsightFacade";
import DatasetHandler from "./DatasetHandler";
import Transformer from "./Transformer";
import TransformationValidator from "./TransformationValidator";

export default class QueryValidator {

    private toString = Object.prototype.toString;
// Start of validating the query
    public static validateQuery(query: any): Promise<boolean> {
        return new Promise((resolve, reject) => {
            for (let key in query) {
                if (key === "WHERE") {
                    if (!(QueryValidator.validateBody(query["WHERE"]))) { Log.trace("body");
                                                                          reject(new InsightError("bad WHERE")); }
                } else if (key === "OPTIONS") {
                    if (!(QueryValidator.validateOptions(query))) {Log.trace("options");
                                                                   reject(new InsightError("bad OPTIONS")); }
                } else if (key === "TRANSFORMATIONS") {
                    if (!(QueryValidator.validateTransformations(query["TRANSFORMATIONS"]))) {
                        reject(new InsightError("bad TRANSFORMATIONS")); }
                } else {
                        reject(new InsightError("Bad Query"));
                }
            }
            let bol: boolean = true;
            let as: boolean = true;
            resolve(bol);
        });
    }
// validation of the where statement
    public static validateBody(body: any): boolean {
        if (toString.call(body) !== "[object Object]") {
            return false;
        }
        if (Object.keys(body).length >= 1) {
            for (let key in body) {
                switch (key) {
                    case "AND":
                    case "OR": {
                        if (!QueryValidator.checkLogic(body[key])) {
                            return false;
                        }
                        break;
                    }
                    case "GT":
                    case "LT":
                    case "EQ": {
                        if (!(QueryValidator.checkMath(body[key]))) {
                            return false;
                        }
                        break;
                    }
                    case "IS": {
                        if (!(QueryValidator.checkString(body[key]))) {
                            return false;
                        }
                        break;
                    }
                    case "NOT": {
                        if (!(QueryValidator.checkNegation(body[key]))) {
                            return false;
                        }
                        break;
                    }
                    default:
                        return false;
                }
                return true;
            }
        } else { return true; }
    }
// validate "AND" & "OR" statements in WHERE statement
    public static checkLogic(lcomp: any): boolean {
        if (toString.call(lcomp) !== "[object Array]") {return false; }
        for (let filter of lcomp) {
            if (!(QueryValidator.validateBody(filter))) {return false; }
        }
        return true;
    }
// validate "EQ", "IS", "GT", or "LT"
    public static checkMath(math: any): boolean {
        if (Object.keys(math).length > 1) {return false; }
        for (let key in math) {
            if (!QueryValidator.checkKey(key)) {return false; }
            if (toString.call(math[key]) !== "[object Number]") {return false; }
        }
        return true;
    }
    public static checkString(s: any): boolean {
        if (Object.keys(s).length > 1) {return false; }
        for (let key in s) {
            if (!QueryValidator.checkKey(key)) {return false; }
            if (typeof s[key] !== "string") {return false; }
        }
        return true;
    }
    public static checkNegation(neg: any): boolean {
        if (toString.call(neg) !== "[object Object]") {return false; }
        return QueryValidator.validateBody(neg);
    }
    public static validateOptions(query: any): boolean {
        let options: any = query["OPTIONS"];
        for (let key in options) {
           if (!(key === "COLUMNS" || key === "ORDER")) {
               return false;
           }
        }
        if (!("COLUMNS" in options)) {return false; }
        if ( query["OPTIONS"]["COLUMNS"].length === 0) { return false; }
        if ("TRANSFORMATIONS" in query) {
            if (! TransformationValidator.checkTransCol(query)) {return false; }
        } else {
        for (let key of options["COLUMNS"]) {
            if (!QueryValidator.checkKey(key)) {
                return false;
            }}}
        if ("ORDER" in options) {
                if (!TransformationValidator.checkOrderKey(query)) {
                    return false;
                }
        }
        return true;
    }
    public static validateTransformations(transformations: any): boolean {
        if (!("GROUP" in transformations)) {return false; }
        if (transformations["GROUP"] <= 0) {return false; }
        if (!(toString.call(transformations["GROUP"]) !== "[Object Array]")) {return false; }
        if (!("APPLY" in transformations)) { return false; }
        for (let key of transformations["GROUP"]) {
            if (!(QueryValidator.checkKey(key))) {
                return false;
            }
        }
        let answer: boolean = TransformationValidator.validateApply(transformations["APPLY"]);
        if (!answer) {return false; }
        return true;
    }
    public static checkDatasets(query: any): Promise<string[]> {
        return new Promise( (fulfill, reject) => {
            let toReturn: string[] = new Array<string>();
            let toCheck: any = [];
            toCheck.push(query["WHERE"]);
            while (toCheck.length !== 0) {
                try {
                    let cur = toCheck.pop();
                    if (toString.call(cur) === "[object Array]") {
                        for (let obj of cur) {
                            toCheck.push(obj);
                        }
                    } else if (toString.call(cur) === "[object Object]") {
                        for (let key in cur) {
                            let added: boolean = false;
                            if (QueryValidator.checkKey(key)) {
                                let toAdd: string = key.substring(0, key.indexOf("_"));
                                if (toReturn.indexOf(toAdd) < 0) {toReturn.push(toAdd); }
                                added = true;
                            }
                            if (!added) {
                                toCheck.push(cur[key]);
                            }
                        }
                    }
                } catch (e) {
                    reject(new InsightError("checkID error"));
                }
            }
            fulfill(toReturn);
        });
    }
    public static filter(sections: object[], query: any): Promise<Array<{}>> {
        return new Promise( (resolve, reject) => {
            let filter = query["WHERE"];
            let filtered: object[] = new Array<object>();
            for (let section of sections) {
                if (QueryValidator.sectionFilter(section, filter)) {filtered.push(section); }
            }
            if ("TRANSFORMATIONS" in query) {
                filtered = Transformer.group(filtered, query);
            }
            Transformer.sort(filtered, query["OPTIONS"]).then( (sorted: object[]) => {
                Transformer.columnFilter(sorted, query["OPTIONS"]["COLUMNS"], query).then((retArray: object[]) => {
                    resolve(retArray);
                }).catch( (e) => {
                    reject(new InsightError("Columns cannot be sorted"));
                });
            }).catch( (e) => {
                reject(new InsightError("Data cannot be sorted"));
            });
        });
    }
    public static sectionFilter(section: object, filter: any): boolean {
        for (let key in filter) {
            let critKey = filter[key];
            let input: string = Object.keys(critKey)[0] ;
            switch (key) {
                case "AND" : {
                    let toRet: boolean = true;
                    for (let f of filter[key]) {
                        let pas = QueryValidator.sectionFilter(section, f);
                        toRet = toRet && pas; }
                    return toRet; }
                case "OR": {
                        let toRet: boolean = false;
                        for (let f of filter[key]) {
                            let pas = QueryValidator.sectionFilter(section, f);
                            toRet = toRet || pas; }
                        return toRet; }
                case "GT": { let compnum = QueryValidator.getKeyData(input, section);
                             return compnum > critKey[input]; }
                case "LT": {
                    let compnum = QueryValidator.getKeyData(input, section); return compnum < critKey[input]; }
                case "EQ": {
                    let compnum = QueryValidator.getKeyData(input, section); return compnum === critKey[input]; }
                case "IS": {
                    let stringinput: string = Object.keys(critKey)[0] ;
                    let compstring = QueryValidator.getKeyData(stringinput, section);
                    let fstring: string = critKey[input];
                    if (fstring.length === 1 && fstring.includes("*")) {if (!(fstring.indexOf("*") === 0)) {
                        throw( new InsightError("Bad *"));
                    } }
                    if (fstring.includes("*") && fstring.indexOf("*") > 0
                        && fstring.indexOf("*") < fstring.length - 1) {throw( new InsightError("bad *")); }
                    let wildcardBack: boolean = fstring.endsWith("*");
                    let wildcardFront: boolean = fstring.startsWith("*");
                    if (wildcardFront && wildcardBack) {
                       fstring = fstring.substring(1, fstring.length - 1);
                       return compstring.includes(fstring);
                    } else if (wildcardBack) {
                        fstring = fstring.substring(0, fstring.length - 1);
                        return compstring.startsWith(fstring);
                    } else if (wildcardFront) {
                        fstring = fstring.substring(1, fstring.length);
                        return compstring.endsWith(fstring);
                    } else {
                    return fstring === compstring; }}
                case "NOT" : {
                        let pass = QueryValidator.sectionFilter(section, filter[key]);
                        return !pass; }
                default: throw (new InsightError("filterone error")) ; }}
        }
    public static checkKey(key: string): boolean {
        key = key.substring(key.indexOf("_") + 1, );
        // "_id", "_dept", "_avg", "_instructor", "_title", "_pass", "_fail", "_audit", "_uuid"
        return key === "id" || key === "dept" || key === "avg" || key === "title" || key === "pass"
            || key === "fail" || key === "audit" || key === "uuid" || key === "instructor" || key === "year"
            || key === "fullname" || key === "shortname" || key === "number" || key === "name"
            || key === "address" || key === "lat" || key === "lon" || key === "seats" || key === "type"
            || key === "furniture" || key === "href";
    }
    public static checkNumKey(key: string): boolean {
        key = key.substring(key.indexOf("_") + 1, );
        // "avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"
        return key === "avg" || key === "pass"
            || key === "fail" || key === "audit" || key === "year"
            || key === "lat" || key === "lon" || key === "seats" ;
    }
    public static getKeyData(key: string, section: any): any {
        if (section[key]) {
            return section[key];
        }
        key = key.substring(key.indexOf("_") + 1, );
        switch (key) {
            case "id" : {
                return section.id; }
            case "dept" : {
                return section.dept; }
            case "avg" : {
                return section.avg; }
            case "instructor" : {
                return section.instructor; }
            case "title" : {
                return section.title; }
            case "pass" : {
                return section.pass; }
            case "fail" : {
                return section.fail; }
            case "audit" : {
                return section.audit; }
            case "uuid" : { return section.uuid; }
            case "year" : { return section.year; }
            case "fullname" : { return section.rooms_fullname; }
            case "shortname" : { return section.rooms_shortname; }
            case "number" : { return section.rooms_number; }
            case "name" : { return section.rooms_name; }
            case "address" : { return section.rooms_address; }
            case "lat" : { return section.rooms_lat; }
            case "lon" : { return section.rooms_lon; }
            case "seats" : { return section.rooms_seats; }
            case "type" : { return section.rooms_type; }
            case "furniture" : { return section.rooms_furniture; }
            case "href" : { return section.rooms_href; }
            default:
                throw(new InsightError("getKeyData error"));
        }
    }
}
