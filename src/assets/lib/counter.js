const counter = () => {
    let privateCounter = 0
  
    const changeBy = (val) => {
      privateCounter  += val
    }
    return {
      increment: () => { changeBy(1) },
      decrement: () => { changeBy(-1) },
      value: () =>  privateCounter 
    }
  }

module.exports = counter