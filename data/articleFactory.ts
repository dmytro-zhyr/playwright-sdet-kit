import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export interface ArticleCreateInput {
  title: string;
  description: string;
  body: string;
  tagList: string[];
}

export const articleFactory = Factory.define<ArticleCreateInput>('article')
  .attr('title', () => `qa ${faker.lorem.sentence(4)}`)
  .attr('description', () => faker.lorem.sentence())
  .attr('body', () => faker.lorem.paragraphs(2))
  .attr('tagList', () => ['qa']);
