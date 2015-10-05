'use strict';

const db = require('./models');
const co = require('co');

let root, R2, R3, R42, R52, R652, R742;

/**
 * * Root []
 * ! * R2 []
 * ! ! * R42 [ 'B' ]
 * ! ! ! * R742 []
 * ! ! * R52 []
 * ! ! ! * R652 []
 * ! * R3 [ 'A' ]
 */
function* buildTestTree() {
    root = yield db.Reference.create({ name: 'Root', parentId: null });
    R2 = yield db.Reference.create({ name: 'R2', parentId: root.id });
    R3 = yield db.Reference.create({ name: 'R3', parentId: root.id });
    R42 = yield db.Reference.create({ name: 'R42', parentId: R2.id });
    R52 = yield db.Reference.create({ name: 'R52', parentId: R2.id });
    R652 = yield db.Reference.create({ name: 'R652', parentId: R52.id });
    R742 = yield db.Reference.create({ name: 'R742', parentId: R42.id });
}

function* buildTestGrants() {
    yield db.Grant.create({ userId: 1, ReferenceId: R3.id, role: 'A'});
    yield db.Grant.create({ userId: 1, ReferenceId: R42.id, role: 'B'});
    yield db.Grant.create({ userId: 1, ReferenceId: R652.id, role: 'C'});
}

function logTree(items, level) {
    items.forEach(function (item) {
        console.log(new Array(level+1).join('! ') + '*', item.name, item.Grants.map(g=>((g.inherited ? '~':'') + g.role)));
        item.children && logTree(item.children, level + 1);
    });
}

co(function* () {
    try {
        yield db.sequelize.sync({force: true});
        yield buildTestTree();
        yield buildTestGrants();

        let rootChildren = yield db.Reference.getChildren(R2.id, 1, false);

        console.log(JSON.stringify(rootChildren, null, '\t'));
        logTree(rootChildren, 0);


    } catch (ex) {
        console.error(ex.stack);
    }
});
