import { ArticleRepository } from './article'
import { CommentRepository } from './comment'
import { MemberRepository } from './member'
import { EventRepository } from './event'
import { ApplicantRepository } from './applicant'
import { GalleryRepository } from './gallery'
import { ContactMessageRepository } from './contact'
import { NewsletterRepository } from './newsletter'
import { SiteRepository } from './site'
import { AdminUserRepository } from './adminUser'

export const articleRepository = new ArticleRepository()
export const commentRepository = new CommentRepository()
export const memberRepository = new MemberRepository()
export const eventRepository = new EventRepository()
export const applicantRepository = new ApplicantRepository()
export const galleryRepository = new GalleryRepository()
export const contactMessageRepository = new ContactMessageRepository()
export const newsletterRepository = new NewsletterRepository()
export const siteRepository = new SiteRepository()
export const adminUserRepository = new AdminUserRepository()

export {
  ArticleRepository,
  CommentRepository,
  MemberRepository,
  EventRepository,
  ApplicantRepository,
  GalleryRepository,
  ContactMessageRepository,
  NewsletterRepository,
  SiteRepository,
  AdminUserRepository,
}
