import { PublishedAnnouncementsController } from './published-announcements.controller';
import { AnnouncementsService } from './announcements.service';

describe('PublishedAnnouncementsController', () => {
  it('has no guard: the front page reads it signed out', () => {
    const prototype =
      PublishedAnnouncementsController.prototype as unknown as Record<
        string,
        object
      >;
    for (const target of [
      PublishedAnnouncementsController,
      ...['list', 'getById', 'getImage'].map((route) => prototype[route]),
    ]) {
      expect(Reflect.getMetadata('__guards__', target)).toBeUndefined();
    }
  });

  it('keeps the page size between 1 and 50', async () => {
    const service = { listPublished: jest.fn() };
    const controller = new PublishedAnnouncementsController(
      service as unknown as AnnouncementsService,
    );

    await controller.list(500);
    await controller.list(0);

    expect(service.listPublished.mock.calls).toEqual([[50], [1]]);
  });
});
