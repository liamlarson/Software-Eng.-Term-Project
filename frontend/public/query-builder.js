/**
 * Builds a query object using the current document object model (DOM).
 * Must use the browser's global document object {@link https://developer.mozilla.org/en-US/docs/Web/API/Document}
 * to read DOM information.
 *
 * @returns query object adhering to the query EBNF
 */
CampusExplorer.buildQuery = function() {
    let query = {};

    let navTab = document.getElementsByClassName("nav-item tab active")[0].getAttribute("data-type");

    if (navTab === "courses") {
        query = buildCoursesQuery();
    } else {
        query = buildRoomsQuery();
    }

    return query;
};

function buildCoursesQuery () {

    let logicalValues = getConditionsWhere("courses");
    let group = getCoursesGroups();
    let apply = getApply("courses");
    let columns = getColumns("courses");
    let order = getOrder("courses");

    console.log({logicalValues, columns, order, group, apply});

    return buildQuery(logicalValues, columns, order, group, apply);
}



function buildRoomsQuery () {

    let logicalValues = getConditionsWhere("rooms");
    let columns = getColumns("rooms");
    let order = getOrder("rooms");
    let group = getRoomsGroups();
    let apply = getApply("rooms");

    console.log({logicalValues, columns, order, group, apply});

    return buildQuery(logicalValues, columns, order, group, apply);
}



function buildQuery (logicalValues, columns, order, group, apply) {
    let query = {};

    query["WHERE"] = logicalValues;

    let options = {};
    options["COLUMNS"] = columns;

    if (order) {
        options["ORDER"] = order;
    }

    query["OPTIONS"] = options;

    if (apply.length > 0) {
        let transformation = {};

        transformation["GROUP"] = group;
        transformation["APPLY"] = apply;

        query["TRANSFORMATIONS"] = transformation;
    }

    return query;
}



function getConditionsWhere (dataset) {
    let activePanel = document.getElementsByClassName("tab-panel active")[0];

    let and = document.getElementById(dataset + "-conditiontype-all").checked;
    let or = document.getElementById(dataset + "-conditiontype-any").checked;
    let none = document.getElementById(dataset + "-conditiontype-none").checked;

    let conditions = activePanel.getElementsByClassName("control-group condition");

    let filters = [];

    for (let condition of conditions) {
        let not = condition.getElementsByClassName("control not")[0].children[0].checked;
        let field = condition.getElementsByClassName("control fields")[0].children[0].value;
        let operator = condition.getElementsByClassName("control operators")[0].children[0].value;
        let term = condition.getElementsByClassName("control term")[0].children[0].value;

        let comparison = {};

        let termFloat = parseFloat(term);

        if (isNaN(termFloat)) { comparison[dataset + "_" + field] = term;
        } else { comparison[dataset + "_" + field] = termFloat; }

        let filter = {};
        filter[operator] = comparison;

        if (not) {
            filters.push({"NOT": filter})
        } else {
            filters.push(filter);
        }
    }

    if (filters.length === 1) {
        return filters [0];
    }
    if (filters.length === 0) {
        return {};
    }
    let logicComparison = {};
    if (and) { logicComparison["AND"] = filters; }
    if (or) { logicComparison["OR"] = filters; }
    if (none) { logicComparison["NOT"] = {"OR": filters}; }

    return logicComparison;
}



function getColumns (dataset) {
    let activePanel = document.getElementsByClassName("tab-panel active")[0];

    let columnFormGroup = activePanel.getElementsByClassName("form-group columns")[0];
    let columnGroup = columnFormGroup.getElementsByClassName("control-group")[0];

    let columns = [];

    for (let column of columnGroup.children) {
        let field = column.getElementsByTagName("input")[0];
        if (field.checked) {
            if (column.className === "control field") {
                columns.push(dataset + "_" + field.value);
            } else {
                columns.push(field.value);
            }
        }
    }

    return columns;
}



function getOrder (dataset) {
    let activePanel = document.getElementsByClassName("tab-panel active")[0];

    let optionsTab = activePanel.getElementsByClassName("control order fields")[0];
    let selectors = optionsTab.getElementsByTagName("select")[0];

    let orderColumns = getOrderColumns(dataset, selectors);

    if (orderColumns.length === 1) {
        return orderColumns[0]
    } else if (orderColumns.length > 1){
        let order = {};
        let isDescending = dataset === "courses" ?
            document.getElementById("courses-order").checked :
            document.getElementById("rooms-order").checked;

        if (!isDescending) {
            order["dir"] = "UP";
        } else {
            order["dir"] = "DOWN";
        }

        order["keys"] = orderColumns;
        return order;
    } else {
        return undefined;
    }
}



function getOrderColumns (dataset, selectors) {
    let orderColumns = [];

    for (let selector of selectors) {
        if (selector.selected) {
            if (selector.className === "transformation") {
                orderColumns.push(selector.value);
            } else {
                orderColumns.push(dataset + "_" + selector.value);
            }
        }
    }
    return orderColumns;
}



function getCoursesGroups () {
    let audit = document.getElementById("courses-groups-field-audit").checked;
    let avg = document.getElementById("courses-groups-field-avg").checked;
    let dept = document.getElementById("courses-groups-field-dept").checked;
    let fail = document.getElementById("courses-groups-field-fail").checked;
    let id = document.getElementById("courses-groups-field-id").checked;
    let instructor = document.getElementById("courses-groups-field-instructor").checked;
    let pass = document.getElementById("courses-groups-field-pass").checked;
    let title = document.getElementById("courses-groups-field-title").checked;
    let uuid = document.getElementById("courses-groups-field-uuid").checked;
    let year = document.getElementById("courses-groups-field-year").checked;

    let groups = [];

    if (audit) { groups.push("courses_audit"); }
    if (avg) { groups.push("courses_avg"); }
    if (dept) { groups.push("courses_dept"); }
    if (fail) { groups.push("courses_fail"); }
    if (id) { groups.push("courses_id"); }
    if (instructor) { groups.push("courses_instructor"); }
    if (pass) { groups.push("courses_pass"); }
    if (title) { groups.push("courses_title"); }
    if (uuid) { groups.push("courses_uuid"); }
    if (year) { groups.push("courses_year"); }

    return groups;
}



function getRoomsGroups () {
    let address = document.getElementById("rooms-groups-field-address").checked;
    let fullName = document.getElementById("rooms-groups-field-fullname").checked;
    let furniture = document.getElementById("rooms-groups-field-furniture").checked;
    let link = document.getElementById("rooms-groups-field-href").checked;
    let lat = document.getElementById("rooms-groups-field-lat").checked;
    let lon = document.getElementById("rooms-groups-field-lon").checked;
    let name = document.getElementById("rooms-groups-field-name").checked;
    let number = document.getElementById("rooms-groups-field-number").checked;
    let seats = document.getElementById("rooms-groups-field-seats").checked;
    let shortName = document.getElementById("rooms-groups-field-shortname").checked;
    let type = document.getElementById("rooms-groups-field-type").checked;

    let columns = [];

    if (address) { columns.push("rooms_address"); }
    if (fullName) { columns.push("rooms_fullname"); }
    if (furniture) { columns.push("rooms_furniture"); }
    if (link) { columns.push("rooms_href"); }
    if (lat) { columns.push("rooms_lat"); }
    if (lon) { columns.push("rooms_lon"); }
    if (name) { columns.push("rooms_name"); }
    if (number) { columns.push("rooms_number"); }
    if (seats) { columns.push("rooms_seats"); }
    if (shortName) { columns.push("rooms_shortname"); }
    if (type) { columns.push("rooms_type"); }

    return columns;
}




function getApply (dataset) {
    let activePanel = document.getElementsByClassName("tab-panel active")[0];

    let transformations = activePanel.getElementsByClassName("control-group transformation");

    let apply = [];

    for (let transformation of transformations) {
        let term = transformation.getElementsByClassName("control term")[0].children[0].value;
        let operator = transformation.getElementsByClassName("control operators")[0].children[0].value;
        let fields = transformation.getElementsByClassName("control fields")[0].children[0].value;

        let rule = {};
        rule[operator] = dataset + "_" + fields;

        let name = {};
        name[term] = rule;

        apply.push(name);
    }

    return apply;
}












