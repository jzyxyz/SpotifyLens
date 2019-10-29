const _ = require('lodash')
const R = require('ramda')

const headWithCount = list => {
  const head = list[0]
  return {
    ...head,
    count: list.length,
  }
}
const countGroupBy = iteratee => list => {
  const identity = el => el
  const copy = list.map(identity)
  return _.chain(copy)
    .groupBy(iteratee)
    .values()
    .map(headWithCount)
    .value()
}
const orderByCountAndName = list =>
  _.orderBy(list, ['count', 'name'], ['desc', 'asc'])

const countBy_ThenOrder = key =>
  R.pipe(
    countGroupBy(el => el[key]),
    orderByCountAndName,
  )

/**
 * @param  {} obj
 * {a: b} to {name: a, value: b}
 */
const nameKV = obj =>
  _.toPairs(obj).map(el => ({
    name: el[0],
    value: el[1],
  }))

const averageReduceByKey = keys => (acc, cur) => {
  const obj = {}
  keys.forEach(key => {
    obj[key] = (acc[key] + cur[key]) / 2
  })
  return obj
}

module.exports = {
  countBy_ThenOrder,
  nameKV,
  averageReduceByKey,
}
