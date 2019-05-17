import Log from "../Util";
import {InsightError} from "./IInsightFacade";

export default class QueryHandler {

    public static getDatasetToQuery (where: any, options: any) {
        try {
            this.validateOptions(options);
            let col0 = options.COLUMNS[0];
            let parts = col0.split("_");
            if (parts.length !== 2) {
                throw new InsightError("Invalid dataset to query");
            }
            return parts[0];
        } catch (e) { throw new InsightError(e.message); }
    }

    public static filterResults (id: any, where: any, data: any) {
        let results = data;
        if (Object.keys(where).length > 1) { throw new InsightError("WHERE should only have 1 key"); }
        if (Object.keys(where).length < 1) { return results; }
        let key = Object.keys(where)[0];

        if (["IS", "LT", "EQ", "GT"].includes(key)) {
            let colParts;
            try {
                colParts = Object.keys(where[key])[0].split("_");
            } catch (e) { throw new InsightError(`${key} must be an object`); }
            if (colParts.length !== 2) { throw new InsightError(`${key} must be an object`); }
            if (colParts[0] !== id) { throw new InsightError("Cannot query more than one dataset"); }
            if (!this.isValidKey(colParts[1], data[0])) { throw new InsightError("Invalid Key"); }
        }
        if (key === "IS") {
            results = this.isFilter(id, where, results);
        } else if (key === "LT") {
            let value = where.LT[Object.keys(where.LT)[0]];
            if (typeof value !== "number") { throw new InsightError("LT must be applied to a number"); }
            results = results.filter((d: any) => d[Object.keys(where.LT)[0]] < value);
        } else if (key === "EQ") {
            let value = where.EQ[Object.keys(where.EQ)[0]];
            if (typeof value !== "number") { throw new InsightError("EQ must be applied to a number"); }
            results = results.filter((d: any) => d[Object.keys(where.EQ)[0]] === value);
        } else if (key === "GT") {
            let value = where.GT[Object.keys(where.GT)[0]];
            if (typeof value !== "number") { throw new InsightError("GT must be applied to a number"); }
            results = results.filter((d: any) => d[Object.keys(where.GT)[0]] > value);
        } else if (["AND", "OR", "NOT"].includes(key)) {
            results = this.logicFilterResults(id, where, key, results);
        } else {
            throw new InsightError(`Invalid filter key ${key}`);
        }
        return results;
    }

    public static isValidKey (key: any, data: any) {
        for (let col of Object.keys(data)) {
            let colparts = col.split("_");
            if (key === colparts[1]) {
                return true;
            }
        }
        return false;
    }

    public static logicFilterResults (id: any, where: any, key: any, results: any) {
        if (key === "AND") {
            let filters = where.AND;
            let temp: any = [];
            if (!Array.isArray(filters) || filters.length === 0) {
                throw new InsightError("AND must be a non-empty array");
            }
            for (let i = 0; i < filters.length; i++) {
                let filter = filters[i];
                let subResult = this.filterResults(id, filter, results);
                if (i === 0) {
                    temp = subResult;
                } else {
                    temp = temp.filter((value: any) => subResult.includes(value));
                }
            }
            results = temp;
        }
        if (key === "OR") {
            let filters = where.OR;
            let temp: any = [];
            if (!Array.isArray(filters) || filters.length === 0) {
                throw new InsightError("OR must be a non-empty array");
            }
            for (let filter of filters) {
                let subResult = this.filterResults(id, filter, results);
                temp = [...new Set([...subResult, ...temp])];
            }
            results = temp;
        }
        if (key === "NOT") {
            let filter = where.NOT;
            let subResult = this.filterResults(id, filter, results);
            results = results.filter((value: any) => !subResult.includes(value));
        }
        return results;
    }

    public static isFilter (id: any, where: any, results: any) {
        let colParts;
        try { colParts = Object.keys(where.IS)[0].split("_");
        } catch (e) { throw new InsightError("Is must be an object"); }
        if (colParts.length !== 2) { throw new InsightError("Is must be an object"); }
        if (colParts[0] !== id) { throw new InsightError("Cannot query more than one dataset"); }
        if (!this.isValidKey(colParts[1], results[0])) {
            throw new InsightError("Invalid Key");
        }

        let value = where.IS[Object.keys(where.IS)[0]];
        if (typeof value !== "string" || value === undefined) {
            throw new InsightError("IS must be applied to a string");
        }
        if (!value.includes("*")) {
            return results.filter((d: any) => d[Object.keys(where.IS)[0]] === value);

        } else {
            if (!this.validIS(value)) {
                throw new InsightError("Asterisks (*) can only be " +
                    "the first or last characters of input strings");
            }

            let valWithoutWildCard = value.replace(new RegExp("\\*", "g"), "");
            if (value.split("*").length === 3) {
                return results.filter((d: any) =>
                    d[Object.keys(where.IS)[0]].includes(valWithoutWildCard));
            }

            let regex: any;
            if (value.indexOf("*") === 0) {
                regex = new RegExp(valWithoutWildCard + "$");
            }
            if (value.indexOf("*") === value.length - 1) {
                regex = new RegExp("^" + valWithoutWildCard);
            }
            return results.filter((d: any) => regex.test(d[Object.keys(where.IS)[0]]));
        }
    }

    private static validIS (filter: any) {
        if (filter.indexOf("*") === -1) {
            return true;
        }
        let parts = filter.split("*");
        if (parts.length === 2) {
            if (parts[0] !== "" && parts[1] !== "") { return false; }
        }
        if (parts.length === 3) {
            if (parts[0] !== "" || parts[2] !== "") { return false; }
        }
        return parts.length <= 3;
    }

    public static filterColumns (id: any, options: any, results: any) {

        if (results.length === 0) { return results; }
        if (!this.isValidFilter(options.COLUMNS, Object.keys(results[0]))) {
            throw new InsightError("Invalid key in columns");
        }
        let newResult: any = [];
        let index = 0;
        for (let result of results) {
            for (let key of Object.keys(result)) {
                if (options.COLUMNS.includes(key)) {
                    if (!newResult[index]) {
                        newResult[index] = {};
                    }
                    newResult[index][key] = result[key];
                }
            }
            index++;
        }
        return newResult;
    }

    public static validateOptions (options: any) {
        if (!options.COLUMNS) {
            throw new InsightError("OPTIONS missing COLUMNS");
        }
        if (Object.keys(options).length > 2) {
            throw new InsightError("Invalid keys in OPTIONS");
        }
        if (Object.keys(options).length === 2 && options.ORDER === undefined) {
            throw new InsightError("Invalid keys in OPTIONS");
        }
        if (Object.keys(options).length === 2) {
            if (options.ORDER === null || options.ORDER === undefined) {
                throw new InsightError("ORDER key cannot be null or undefined");
            }
            if (!this.isOrderKeyInColumns(options.ORDER, options.COLUMNS) && !options.ORDER.dir) {
                throw new InsightError("ORDER key must be in COLUMNS");
            }
        }
    }

    public static isValidFilter (columns: any, allColumns: any) {
        if (columns === undefined) {
            return false;
        }
        for (let column of columns) {
            if (!allColumns.includes(column)) {
                return false;
            }
        }
        return true;
    }

    public static orderResults (options: any, results: any) {

        let order = options.ORDER;

        if (!order) {
            return results;
        }
        if (!this.isOrderKeyInColumns(order, options.COLUMNS) && !order.dir) {
            throw new InsightError("ORDER key must be in COLUMNS");
        }
        if (order.dir) {
            if (!this.isValidSort(options.COLUMNS, order.dir, order.keys)) {
                throw new InsightError("SORT key must be in COLUMNS");
            }
        }
        results.sort((a: any, b: any) => {
            if (order.dir === "UP") {
                return this.orderAscending(a, b, order.keys);
            } else if (order.dir === "DOWN") {
                return this.orderDescending(a, b, order.keys);
            } else {
                let aVal = a[order];
                let bVal = b[order];
                if (typeof aVal === "number") {
                    return aVal - bVal;
                } else {
                    return aVal.localeCompare(bVal);
                }
            }
        });
        return results;
    }

    public static isOrderKeyInColumns (order: any, columns: any) {
        if (columns === undefined) {
            return false;
        }
        return columns.includes(order);
    }

    public static isValidSort (columns: any, dir: any, keys: any) {
        if (columns === undefined) {
            return false;
        }
        if (dir !== "UP" && dir !== "DOWN") {
            return false;
        }
        for (let key of keys) {
            if (!columns.includes(key)) {
                return false;
            }
        }
        return true;
    }
    public static orderAscending (a: any, b: any, keys: any): any {
        let index = 0;
        let comp = 0;
        while (index !== keys.length && comp === 0) {
            let key = keys[index++];
            let aVal = a[key];
            let bVal = b[key];
            if (typeof aVal === "number") {
                comp = aVal - bVal;
            } else {
                comp = aVal.localeCompare(bVal);
            }
        }
        return comp;
    }

    public static orderDescending (a: any, b: any, keys: any): any {
        let index = 0;
        let comp = 0;
        while (index !== keys.length && comp === 0) {
            let key = keys[index++];
            let aVal = a[key];
            let bVal = b[key];
            if (typeof aVal === "number") {
                comp = aVal - bVal;
            } else {
                comp = aVal.localeCompare(bVal);
            }
            comp *= -1;
        }
        return comp;
    }
}
