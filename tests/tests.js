import { html, partition, _test as libTest } from '../js/lib.js'
import { validate } from '../js/client.js'
import { computeDebts } from '../js/handlers/balance.js'
import testAttachRoutes from './testAttachRoutes.js'
import testCrypto from './testCrypto.js'

export default function () {
  suite('Events validation', testValidate)
  suite('partition function', testPartition)
  suite('debt calculation', testComputeDebts)
  suite('HTML escape function', testHtml)
  suite('Event routing system', () => {
    suite('parsing', testParseRoutes)
    suite('attachement', testAttachRoutes)
  })
  suite('Crypto', testCrypto)
  suite('Kebab', testKebab)

  mocha.run()
}

function testParseRoutes () {
  const parseRoutes = libTest.parseRoutes
  const tests = [
    ['click', null],
    ['submit => form', null],
    ['submit -> div.active', null],
    ['click => form.active -> button', null],
    [' ', null]
  ]

  const routes = parseRoutes(tests)
  test('parse routes', () => {
    assert.lengthOf(routes, 5)

    assert.equal(routes[0].eventType, 'click')
    assert.equal(routes[0].selector, null)
    assert.equal(routes[0].delegatedSelector, null)

    assert.equal(routes[1].eventType, 'submit')
    assert.equal(routes[1].selector, 'form')
    assert.equal(routes[1].delegatedSelector, null)

    assert.equal(routes[2].eventType, 'submit')
    assert.equal(routes[2].selector, null)
    assert.equal(routes[2].delegatedSelector, 'div.active')

    assert.equal(routes[3].eventType, 'click')
    assert.equal(routes[3].selector, 'form.active')
    assert.equal(routes[3].delegatedSelector, 'button')
  })
}

function testValidate () {
  test('allow valid events', () => {
    assert(validate(
      { _id: '5dfe9cfa4c88c20017b0da51', command: 'init_trip', data: { name: 'Vacation Spain', currency: 'EUR', members: ['Chuck', 'Jacky', 'Bruce'] }, version: 1, _createdOn: '2019-12-21T22:30:18.724Z' }, { _id: '5dff4ec789e555001711a1b2', command: 'add_expense', data: { title: 'First spend', amount: '32', creditor: 'Simon', participants: ['Simon', 'Pauline', 'Vincent'], date: '2019-12-22', currency: 'EUR' }, version: 1, _createdOn: '2019-12-22T11:08:55.440Z' }
    ))
    assert(validate(
      { _id: '5dfff89989e555001711a344', command: 'add_expense', data: { title: 'Hello', amount: '543.7', creditor: 'Chuck', participants: ['Chuck', 'Bruce'], date: '2019-12-22', currency: 'EUR' }, version: 1, _createdOn: '2019-12-22T23:13:29.784Z' }
    ))
  })

  test('disallow invalid events', () => {
    assert.throws(() => validate({}))
    assert.throws(() => validate({ command: 'unknown' }))
    assert.throws(() => validate({ command: 'init_trip', version: 4 }))
    assert.throws(() => validate({ command: 'init_trip', _createdOn: '2019', data: null }))
    assert.throws(() => validate({ command: 'init_trip', _createdOn: '2019', data: { name: '', currency: 'chf', members: [] } }))
    assert.throws(() => validate({ _id: '5dfff89989e555001711a344', command: 'add_expense', data: { title: 'Hello', amount: '543,7', creditor: 'Chuck', participants: ['Chuck', 'Bruce'], date: '2019-12-22', currency: 'EUR' }, version: 1, _createdOn: '2019-12-22T23:13:29.784Z' }))
  })
}

function testPartition () {
  test('partition', () => {
    const p1 = partition(n => n % 2 === 0, [1, 2, 3, 4, 5, 6])
    const p2 = partition(n => n % 2 === 0, [2, 1, 3, 4, 5, 6])

    assert.isTrue(p1.size === 2)
    assert.isTrue(p2.size === 2)

    assert.deepEqual(p1.get(true), [2, 4, 6])
    assert.deepEqual(p1.get(false), [1, 3, 5])
  })

  test('partition by string', () => {
    const p1 = partition('age', [
      { name: 'Dock', age: 34 },
      { name: 'Dopey', age: 35 },
      { name: 'Bashful', age: 12 },
      { name: 'Grumpy', age: 12 },
      { name: 'Sneezy', age: 17 },
      { name: 'Sleepy', age: 34 }
    ])

    assert.isTrue(p1.size === 4)

    assert.deepEqual(p1.get(34).map(d => d.name), ['Dock', 'Sleepy'])
    assert.deepEqual(p1.get(35).map(d => d.name), ['Dopey'])
    assert.deepEqual(p1.get(12).map(d => d.name), ['Bashful', 'Grumpy'])
    assert.deepEqual(p1.get(17).map(d => d.name), ['Sneezy'])
  })
}

function testComputeDebts () {
  test('accurately computes reimbursment strategy (creditor majority)', () => {
    const balances = new Map([
      ['Marco', 30.23],
      ['Christopher', 990.93],
      ['Thomas', -1021.17]
    ])

    assert.sameDeepMembers(computeDebts(balances), [
      { creditor: 'Christopher', debtor: 'Thomas', amount: 990.93 },
      { creditor: 'Marco', debtor: 'Thomas', amount: 30.23 }
    ])
  })

  test('accurately computes reimbursment strategy (debtor majority)', () => {
    const balances = new Map([
      ['Marco', -300],
      ['Christopher', -300],
      ['Thomas', 400],
      ['Vasco', -100],
      ['Erik', 300]
    ])

    assert.sameDeepMembers(computeDebts(balances), [
      { creditor: 'Thomas', debtor: 'Marco', amount: 300 },
      { creditor: 'Erik', debtor: 'Christopher', amount: 300 },
      { creditor: 'Thomas', debtor: 'Vasco', amount: 100 }
    ])
  })
}

function testHtml () {
  test('safely escape html body and attributes', () => {
    const name = '<script>alert("you got hacked")</script>'
    const result = html`
      <p>
        Hello ${name}...<strong name="heading-${'5" malicious="l337'}">${'and welcome'}</strong>
      </p>`

    assert.equal(result.tagName, 'P')
    assert.equal(result.querySelector('strong').innerText, 'and welcome')
    assert.equal(result.querySelector('script'), null)
    assert.isTrue(result.innerText.indexOf('<script>') > 0)
    assert.equal(result.querySelector('strong').getAttribute('malicious'), null)
    assert.equal(result.querySelector('strong').getAttribute('name'), 'heading-5" malicious="l337')
  })

  test('inserts dynamic DOM elements', () => {
    const child = html`<span class="child">SPAN</span>`
    const parent = html`<p>Insert a ${child} here</p>`
    const grandParent = html`<div>${[parent, parent.cloneNode(true), parent.cloneNode(true)]}<div>`

    assert.equal(parent.querySelector('.child').innerText, 'SPAN')
    assert.lengthOf(grandParent.querySelectorAll('.child'), 3)
  })
}

function testKebab () {
  const kebab = libTest.kebab
  test('compute kebab-case', () => {
    const cases = [
      ['MyComponent', 'my-component'],
      ['MyVeryLongComponent', 'my-very-long-component'],
      ['A', 'a'],
      ['camelCased', 'camel-cased'],
      ['kebab-already', 'kebab-already']
    ]

    for (const [string, expected] of cases) {
      assert.equal(kebab(string), expected, `testing: "${string}"`)
    }
  })
}
