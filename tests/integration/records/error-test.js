import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import DS from 'ember-data';
import setupStore from 'dummy/tests/helpers/store';
import testInDebug from 'dummy/tests/helpers/test-in-debug';
import RSVP from 'rsvp';

var env, store, Person;
var attr = DS.attr;

function updateErrors(func, assert) {
  assert.expectWarning(function() {
    run(func);
  }, 'Interacting with a record errors object will no longer change the record state.');
}

module('integration/records/error', {
  beforeEach: function() {
    Person = DS.Model.extend({
      firstName: attr('string'),
      lastName: attr('string'),
    });

    env = setupStore({
      person: Person,
    });

    store = env.store;
  },

  afterEach: function() {
    run(function() {
      env.container.destroy();
    });
  },
});

testInDebug('adding errors during root.loaded.created.invalid works', function(assert) {
  assert.expect(5);

  var person = run(() => {
    store.push({
      data: {
        type: 'person',
        id: 'wat',
        attributes: {
          firstName: 'Yehuda',
          lastName: 'Katz',
        },
      },
    });
    return store.peekRecord('person', 'wat');
  });

  run(() => {
    person.set('firstName', null);
    person.set('lastName', null);
  });

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.updated.uncommitted');

  updateErrors(() => person.get('errors').add('firstName', 'is invalid'), assert);

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.updated.invalid');

  updateErrors(() => person.get('errors').add('lastName', 'is invalid'), assert);

  assert.deepEqual(person.get('errors').toArray(), [
    { attribute: 'firstName', message: 'is invalid' },
    { attribute: 'lastName', message: 'is invalid' },
  ]);
});

testInDebug('adding errors root.loaded.created.invalid works', function(assert) {
  assert.expect(5);

  let person = store.createRecord('person', {
    id: 'wat',
    firstName: 'Yehuda',
    lastName: 'Katz',
  });

  run(() => {
    person.set('firstName', null);
    person.set('lastName', null);
  });

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.uncommitted');

  updateErrors(() => person.get('errors').add('firstName', 'is invalid'), assert);

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.invalid');

  updateErrors(() => person.get('errors').add('lastName', 'is invalid'), assert);

  assert.deepEqual(person.get('errors').toArray(), [
    { attribute: 'firstName', message: 'is invalid' },
    { attribute: 'lastName', message: 'is invalid' },
  ]);
});

testInDebug('adding errors root.loaded.created.invalid works add + remove + add', function(assert) {
  assert.expect(7);

  let person = store.createRecord('person', {
    id: 'wat',
    firstName: 'Yehuda',
  });

  run(() => {
    person.set('firstName', null);
  });

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.uncommitted');

  updateErrors(() => person.get('errors').add('firstName', 'is invalid'), assert);

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.invalid');

  updateErrors(() => person.get('errors').remove('firstName'), assert);

  assert.deepEqual(person.get('errors').toArray(), []);

  updateErrors(() => person.get('errors').add('firstName', 'is invalid'), assert);

  assert.deepEqual(person.get('errors').toArray(), [
    { attribute: 'firstName', message: 'is invalid' },
  ]);
});

testInDebug('adding errors root.loaded.created.invalid works add + (remove, add)', function(
  assert
) {
  assert.expect(6);

  let person = store.createRecord('person', {
    id: 'wat',
    firstName: 'Yehuda',
  });

  run(() => {
    person.set('firstName', null);
  });

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.uncommitted');

  updateErrors(() => {
    person.get('errors').add('firstName', 'is invalid');
  }, assert);

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.invalid');

  updateErrors(() => {
    person.get('errors').remove('firstName');
    person.get('errors').add('firstName', 'is invalid');
  }, assert);

  assert.equal(person._internalModel.currentState.stateName, 'root.loaded.created.invalid');

  assert.deepEqual(person.get('errors').toArray(), [
    { attribute: 'firstName', message: 'is invalid' },
  ]);
});

test('using setProperties to clear errors', function(assert) {
  env.adapter.reopen({
    createRecord() {
      return RSVP.reject(
        new DS.InvalidError([
          {
            detail: 'Must be unique',
            source: { pointer: '/data/attributes/first-name' },
          },
          {
            detail: 'Must not be blank',
            source: { pointer: '/data/attributes/last-name' },
          },
        ])
      );
    },
  });

  return run(() => {
    let person = store.createRecord('person');

    return person.save().then(null, function() {
      let errors = person.get('errors');

      assert.equal(errors.get('length'), 2);
      assert.ok(errors.has('firstName'));
      assert.ok(errors.has('lastName'));

      person.setProperties({
        firstName: 'updated',
        lastName: 'updated',
      });

      assert.equal(errors.get('length'), 0);
      assert.notOk(errors.has('firstName'));
      assert.notOk(errors.has('lastName'));
    });
  });
});
