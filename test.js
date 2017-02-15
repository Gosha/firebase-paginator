var test = require('tape');
var firebase = require('firebase');
var path = 'firebasePaginator/collection';
var smallCollectionPath = 'firebasePaginator/small-collection';
var emptyCollectionPath = 'firebasePaginator/empty-collection';
var childCollectionPath = 'firebasePaginator/child-collection';
var smallChildCollectionPath = 'firebasePaginator/small-child-collection';
var firebaseConfig = require('./env.json').firebaseConfig;

firebase.initializeApp(firebaseConfig);

var FirebasePaginator = require('./firebase-paginator');
var ref = firebase.database().ref(path);
var smallCollectionRef = firebase.database().ref(smallCollectionPath);
var emptyCollectionRef = firebase.database().ref(emptyCollectionPath);
const childKey = 'child';
var childCollectionRef = firebase.database().ref(childCollectionPath);
var smallChildCollectionRef = firebase.database().ref(smallChildCollectionPath);

function populateCollection(count, ref) {
  return new Promise(function (resolve, reject) {
    var promises = [];
    var i = count;

    while (i--) {
      promises.push(ref.push(count - i));
    }

    Promise.all(promises).then(resolve, reject);
  });
};

function populateChildCollection(count, ref) {
  function shuffle(array) {
    var tmp, current, top = array.length;

    if (top) while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = array[current];
      array[current] = array[top];
      array[top] = tmp;
    }

    return array;
  }

  return new Promise(function (resolve, reject) {
    var promises = [];
    var i = count;
    var indices = [];

    while (i--) {
      indices.push(i);
    }

    shuffle(indices).forEach((i) => {
      promises.push(ref.push({child: i}));
    });

    Promise.all(promises).then(resolve, reject);
  });
};

function testChildPage(paginator, childKey, length, start, end, testName) {
  // ES2017 Shim
  Object.values = Object.values || (obj => Object.keys(obj).map(key => obj[key]));

  return new Promise(function (resolve, reject) {
    test(testName || `should return records ${start} to ${end}`, function (t) {
      paginator.once('value', function (snap) {
        var keys = Object.keys(this.collection);

        var collection = Object.values(this.collection).sort((a, b) => {
          if (a[childKey] > b[childKey])
            return -1;
          if (a[childKey] < b[childKey])
            return 1;
          return 0;
        });

        var i = keys.length;
        t.equal(i, length);
        t.equal(collection[0][childKey], start);
        t.equal(collection[i - 1][childKey], end);
        t.end();
        resolve(paginator);
      });
    });
  });
};

function testPage(paginator, length, start, end, testName) {
  return new Promise(function (resolve, reject) {
    test(testName || `should return records ${start} to ${end}`, function (t) {
      paginator.once('value', function (snap) {
        var collection = this.collection;
        var keys = Object.keys(collection);
        var i = keys.length;
        t.equal(i, length);
        t.equal(collection[keys[0]], start);
        t.equal(collection[keys[i - 1]], end);
        t.end();
        resolve(paginator);
      });
    });
  });
};

return ref.once('value')
  .then(function (snap) {
    if (snap.numChildren() === 100) {
      return true;
    } else {
      return populateCollection(100, ref);
    }
  })
  .then(function() {
    return smallCollectionRef.once('value');    
  })
  .then(function(snap) {
    if (snap.numChildren() == 3) {
      return true;
    } else {
      return populateCollection(3, smallCollectionRef);
    }
  })
  .then(function() {
    return childCollectionRef.once('value');
  })
  .then(function(snap) {
    if (snap.numChildren() == 29) {
      return true;
    } else {
      return populateChildCollection(29, childCollectionRef);
    }
  })
  .then(function() {
    return smallChildCollectionRef.once('value');
  })
  .then(function(snap) {
    if (snap.numChildren() == 3) {
      return true;
    } else {
      return populateChildCollection(3, smallChildCollectionRef);
    }
  })
  .then(function() {
    return emptyCollectionRef.remove();
  })

  .then(function() { // Test child collection pagination
    return new FirebasePaginator(childCollectionRef, {
      orderByChild: childKey
    });
  })
  .then(function(paginator) {
    return testChildPage(paginator, childKey, 10, 28, 19);
  })
  .then(function(paginator) {
    paginator.next();
    return testChildPage(paginator, childKey, 10, 28, 19);
  })
  .then(function(paginator) {
    paginator.previous();
    return testChildPage(paginator, childKey, 10, 18, 9);
  })
  .then(function(paginator) {
    paginator.previous();
    return testChildPage(paginator, childKey, 9, 8, 0);
  })
  .then(function(paginator) {
    paginator.previous();
    return testChildPage(paginator, childKey, 9, 8, 0);
  })
  .then(function(paginator) {
    paginator.next();
    return testChildPage(paginator, childKey, 10, 18, 9);
  })
  .then(function(paginator) {
    paginator.next();
    return testChildPage(paginator, childKey, 10, 28, 19);
  })

  .then(function() { // Test small child collection pagination
    return new FirebasePaginator(smallChildCollectionRef, {
      orderByChild: childKey
    });
  })
  .then(function(paginator) {
    return testChildPage(paginator, childKey, 3, 2, 0);
  })
  .then(function(paginator) {
    paginator.previous();
    return testChildPage(paginator, childKey, 3, 2, 0);
  })
  .then(function(paginator) {
    paginator.next();
    return testChildPage(paginator, childKey, 3, 2, 0);
  })

  .then(function() { // Test empty child collection pagination
    return new FirebasePaginator(emptyCollectionRef, {
      orderByChild: childKey
    });
  })
  .then(function(paginator) {
    return testPage(paginator, 0, undefined, undefined);
  })

  .then(function() { // Test empty collection inifite pagination
    return new FirebasePaginator(emptyCollectionRef);
  })
  .then(function(paginator) {
    return testPage(paginator, 0, undefined, undefined);
  })
  .then(function() { // Test empty collection finite pagination
    return new FirebasePaginator(emptyCollectionRef, {
      finite: true,
      auth: firebaseConfig.secret
    });
  })
  .then(function(paginator) {
    return testPage(paginator, 0, undefined, undefined);
  })
  .then(function() { // Test small collection infinite pagination
    return new FirebasePaginator(smallCollectionRef);
  })
  .then(function(paginator) {
    return testPage(paginator, 3, 1, 3);
  })
  .then(function() {
    return new FirebasePaginator(smallCollectionRef, {pageSize: 3});
  })
  .then(function(paginator) {
    return testPage(paginator, 3, 1, 3);
  })
  .then(function() { // Test small collection finite pagination
    return new FirebasePaginator(smallCollectionRef, {
      finite: true,
      auth: firebaseConfig.secret
    });
  })
  .then(function(paginator) {
    return testPage(paginator, 3, 1, 3);
  })  
  .then(function () {
    var paginator = new FirebasePaginator(ref);

    // paginator.on('value', function () {
    //   console.log("value\n", paginator.collection);
    // });

    return paginator;
  })
  .then(function (paginator) {
    return testPage(paginator, 10, 91, 100);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 81, 90);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 71, 80);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 61, 70);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 51, 60);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 41, 50);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 31, 40);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 21, 30);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 11, 20);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 1, 10);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 1, 10, 'should fail to back paginate and stick at 1 to 10');
  })
  .then(function () {
    var paginator = new FirebasePaginator(ref, {
      pageSize: 3
    });

    // paginator.on('value', function () {
    //   console.log("value\n", paginator.collection);
    // });
    
    return paginator;
  })
  .then(function (paginator) {
    return testPage(paginator, 3, 98, 100);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 3, 95, 97);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 3, 92, 94);
  })
  .then(function (paginator) {
    paginator.next();
    return testPage(paginator, 3, 95, 97);
  })
  .then(function (paginator) {
    paginator.next();
    return testPage(paginator, 3, 98, 100);
  })
  .then(function (paginator) {
    paginator.next();
    return testPage(paginator, 3, 98, 100, 'should fail to forward paginate and stick 98 to 100');
  })
  .then(function () {
    var paginator = new FirebasePaginator(ref, {
      finite: true,
      auth: firebaseConfig.secret
    });

    // paginator.on('value', function() {
    //   console.log("value\n", paginator.collection);
    // });

    return paginator;
  })
  .then(function (paginator) {
    return testPage(paginator, 10, 91, 100);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 81, 90);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 71, 80);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 61, 70);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 51, 60);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 41, 50);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 31, 40);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 21, 30);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 11, 20);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 1, 10);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 10, 1, 10, 'should fail to back paginate and stick at 1 to 10');
  })
  .then(function () {
    var paginator = new FirebasePaginator(ref, {
      pageSize: 3,
      finite: true,
      auth: firebaseConfig.secret
    });

    // paginator.on('value', function () {
    //   console.log("value\n", paginator.collection);
    // });

    return paginator;
  })
  .then(function (paginator) {
    return testPage(paginator, 3, 98, 100);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 3, 95, 97);
  })
  .then(function (paginator) {
    paginator.previous();
    return testPage(paginator, 3, 92, 94);
  })
  .then(function (paginator) {
    paginator.next();
    return testPage(paginator, 3, 95, 97);
  })
  .then(function (paginator) {
    paginator.next();
    return testPage(paginator, 3, 98, 100);
  })
  .then(function (paginator) {
    paginator.next();
    return testPage(paginator, 3, 98, 100, 'should fail to forward paginate and stick 98 to 100');
  })
  .then(function (paginator) {
    paginator.goToPage(paginator.pageCount - 1);
    return testPage(paginator, 3, 2, 4);
  })
  .then(function (paginator) {
    paginator.goToPage(paginator.pageCount);
    return testPage(paginator, 1, 1, 1, 'the last page should have only one record');
  })
  .then(function () {
    console.log('complete');
    process.exit();
  })
  .catch(function (err) {
    console.log('error', err);
    process.exit();
  });
