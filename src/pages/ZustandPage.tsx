import { useAsteroidStore } from '@/stores/useAsteroidStore';
import { Text, Button, HStack, VStack, Image } from '@chakra-ui/react'
import React from 'react'

const ZustandPage = () => {

  const {
    asteroids,
    increaseAsteroids,
    decreaseAsteroids,
    removeAllAsteroids
  } = useAsteroidStore();

  return (
    <>
      <Image src="./src/assets/images/technologies/zustand.png" width="200px" />
      <VStack>
        <Text>Asteroids: {asteroids}</Text>

        <HStack>
          <Button onClick={() => increaseAsteroids()}>Add asteroid</Button>
          <Button onClick={() => decreaseAsteroids()}>Remove asteroid</Button>
        </HStack>
        <Button onClick={() => removeAllAsteroids()}>Remove all Asteroids</Button>
      </VStack>
    </>
  )
}

export default ZustandPage;
