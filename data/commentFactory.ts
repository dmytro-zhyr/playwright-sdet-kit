import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export interface CommentCreateInput {
  body: string;
}

export const commentFactory = Factory.define<CommentCreateInput>('comment').attr('body', () =>
  faker.lorem.sentence()
);
