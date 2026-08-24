import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export interface NewComment {
  body: string;
}

export const commentFactory = Factory.define<NewComment>('comment').attr('body', () =>
  faker.lorem.sentence()
);
