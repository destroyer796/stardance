class HomeController < ApplicationController
  include OnboardingResumable
  discover_rail_widgets :sticker_promo, :streak, :terra_portal, :forge_promo, :mipmap_promo, :day_one_of_promo, :feedback_promo, :upcoming_events, :referral, :daily_roll

  before_action :resume_or_expire_onboarding!, only: :index, if: -> { current_user.present? }

  def index
    authorize :home
    @body_class = "app-layout-page"
    @welcoming = params[:welcome] == "1" && current_user.present? && !current_user.has_dismissed?("home_intro")
    @body_class += " home-welcoming" if @welcoming

    load_composer if current_user.present?
    load_clearance_sale if Flipper.enabled?(:shop_open, current_user) && Flipper.enabled?(:clearance_sale, current_user)
    if policy(BukuX3::Event).leaderboard?
      leaderboard = BukuX3::Leaderboard.new(BukuX3::Event.current)
      @buku_teams = leaderboard.teams
      @buku_own = leaderboard.own(current_user, @buku_teams)
    end
  end

  private

  # Only sales the visitor could buy from, using the region their shop prices use.
  def load_clearance_sale
    region = current_user ? ShopItem.recommended_region_for(current_user) : "US"
    items = ShopItem.cached_shop_page_data[:buyable_standalone].select { |item| item.enabled_in_region?(region) }
    @clearance_sale = Shop::ClearanceSale.new(items)
  end

  def load_composer
    @devlog = Post::Devlog.new
    @composer_projects = current_user.projects.includes(:hackatime_projects).order(updated_at: :desc)
    @selected_project = selected_composer_project
  end

  def selected_composer_project
    if params[:project_id].present?
      @composer_projects.find_by(id: params[:project_id]) || @composer_projects.first
    else
      @composer_projects.first
    end
  end
end
