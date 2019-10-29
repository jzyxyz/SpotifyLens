const { writeFile } = require('fs')
const { promisify } = require('util')
const write = promisify(writeFile)
const path = require('path')
const { keyBy } = require('lodash')

const countryDataFn = async ctx => {
  const { lens } = ctx
  const countryList = require('./country_list')
  const idIndex = keyBy(countryList, 'id')
  const failed = new Set()

  async function* apiCallGenerator(idList) {
    for (let id of idList) {
      try {
        const data = await lens.calcAll(id)
        yield {
          // ...el,
          ...idIndex[id],
          ...data,
        }
      } catch (error) {
        console.log(error)
        failed.add(id)
        yield {
          ...idIndex[id],
          failed: true,
        }
      }
    }
  }

  const looper = generator => async failedIds => {
    for await (let data of generator(failedIds)) {
      if (data.failed === true) {
        console.log('Still failing', data.name)
      } else {
        if (failed.has(data.id)) {
          failed.delete(data.id)
        }
        // assume writing file would not fail
        write(
          path.join('data', 'country', `${data.name}.json`),
          JSON.stringify(data),
        ).then(() => {
          console.log('wrote', data.name)
        })
      }
    }
  }

  await looper(apiCallGenerator)(countryList.map(el => el.id))
  while (failed.size) {
    await looper(apiCallGenerator)(Array.from(failed))
  }

  ctx.body = {
    message: 'ok',
  }
}

module.exports = {
  countryDataFn,
}
